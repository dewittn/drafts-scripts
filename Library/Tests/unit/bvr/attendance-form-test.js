/**
 * Attendance Form Unit Tests
 *
 * Upper school attendance goes on the school's attendance form instead of an
 * email: Record Attendance asks which absences are unexcused, opens the form
 * prefilled (never posted), and marks the draft submitted only once the coach
 * says the form was sent. Middle school still texts, unchanged.
 *
 * Settings are the real levels/*.yaml, forms.yaml, and teams.yaml; people are
 * synthetic. The flow tests use Library/Tests/fixtures/bvr/teams-levels.json
 * and the real ui.yaml (see fixtures/bvr-stubs.js).
 *
 * Not covered here (needs Drafts): the prompts themselves and the browser.
 */

require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/mocks.js");
require("../Tests/fixtures/bvr-stubs.js");
require("modules/cp/filesystems/CloudFS.js");
require("modules/bvr/utils/Staff.js");
require("modules/bvr/utils/TeamConfig.js");
require("modules/bvr/core/Attendance.js");
require("modules/bvr/core/Team.js");

const test = new TestAssertions("Attendance form");

const allPresent = "Yes, all the athletes are present";

// --- absenceFormData ---
test.section("absenceFormData");

test.assertDeepEqual(
  Attendance.absenceFormData([], [], allPresent),
  { allPresent, excused: undefined, unexcused: undefined },
  "nobody absent: the all-present box, both lists blank",
);
test.assertDeepEqual(
  Attendance.absenceFormData(["Alex Smith", "Jordan Lee"], [], allPresent),
  { allPresent: undefined, excused: "Alex Smith, Jordan Lee", unexcused: undefined },
  "absent players with none marked are all excused",
);
test.assertDeepEqual(
  Attendance.absenceFormData(["Alex Smith", "Jordan Lee", "Sam Park"], ["Jordan Lee"], allPresent),
  { allPresent: undefined, excused: "Alex Smith, Sam Park", unexcused: "Jordan Lee" },
  "marked players are unexcused, the rest excused, in roster order",
);
test.assertDeepEqual(
  Attendance.absenceFormData(["Alex Smith", "Jordan Lee"], ["Jordan Lee", "Alex Smith"], allPresent),
  { allPresent: undefined, excused: undefined, unexcused: "Alex Smith, Jordan Lee" },
  "everyone marked leaves the excused list blank",
);

// --- real settings ---
test.section("real settings");

const staff = new Staff({
  AG: { name: "Head Coach", cell: "555-0101", email: "ag@example.com" },
  AH: { cell: "555-0102", email: "ah@example.com" },
  AN: { cell: "555-0103" },
  HM: { cell: "555-0104" },
  WK: { cell: "555-0105" },
  CK: { cell: "555-0106" },
  AJ: { cell: "555-0107" },
  DG: { name: "Assistant Coach", cell: "555-0108", email: "dg@example.com" },
  ATT: { email: "attendance@example.com" },
});
const levels = { ms: loadRepoYAML("bvr/levels/ms.yaml"), us: loadRepoYAML("bvr/levels/us.yaml") };
const forms = loadRepoYAML("bvr/forms.yaml");
const teamsData = loadRepoYAML("bvr/teams.yaml").teamsData;
const realConfig = (teamID) => {
  const team = teamsData.find((entry) => entry.id == teamID);
  return new TeamConfig({ team, level: levels[team.level], forms, staff, attendanceOffice: "ATT" });
};

const usSettings = realConfig("us-ultimate").attendanceSettings;
test.assertEqual(usSettings.formSettings?.name, "us-attendance", "US attendance resolves to the attendance form");
test.assertEqual(usSettings.formSettings?.postData, false, "which is opened to review, not posted");
test.assertEqual(usSettings.formTeam, "Varsity Ultimate", "us-ultimate's Team dropdown value comes from teams.yaml");
test.assertEqual(usSettings.absencesMsgConfig, undefined, "and the US absences email is off");
test.assertEqual(usSettings.noAbsencesMsgConfig, undefined, "with no no-absences message either");
test.assertDeepEqual(realConfig("us-ultimate").defaultRecipients.attendance, [], "so Start New Season shows no attendance recipients");
test.assertDeepEqual(
  usSettings.formSettings?.fields.map((field) => [field.key, field.entryID]),
  [["hcName", 59639440], ["teamName", 151743401], ["allPresent", 307654852], ["excused", 1275473467], ["unexcused", 1652526151]],
  "the form's entry IDs, as scraped 2026-11-07",
);
test.assertDeepEqual(usSettings.formSettings?.fields[2].options, [allPresent], "the all-present box has its one exact option");

const msSettings = realConfig("msg-basketball").attendanceSettings;
test.assertEqual(msSettings.formSettings, undefined, "MS attendance has no form");
test.assertDeepEqual(
  msSettings.absencesMsgConfig,
  { type: "text", recipients: ["555-0101", "555-0103", "555-0104", "555-0105"], bodyText: "These students are absent from [[team_name]] today: " },
  "MS absences still text the level's recipients",
);
test.assertDeepEqual(
  msSettings.noAbsencesMsgConfig,
  { type: "text", recipients: ["555-0101", "555-0103", "555-0104", "555-0105"], bodyText: "No one is absent from [[team_name]] today." },
  "and so does the no-absences text",
);

// --- Record Attendance flow ---
test.section("Record Attendance flow");

const formLink = "https://docs.google.com/forms/d/e/FORM-ID";
const opened = [];
const queued = [];
const sent = [];
const editorText = [];
/** @type {any} */ (globalThis).app = {
  openURL: (url) => opened.push(url),
  queueAction: (action, target) => queued.push({ action: action.name, content: target.content }),
};
/** @type {any} */ (globalThis).Template = { basePath: "/Library/Templates" };
/** @type {any} */ (globalThis).Action = { find: (name) => ({ name }) };
/** @type {any} */ (globalThis).Draft = class {};
/** @type {any} */ (globalThis).editor = { setText: (text) => editorText.push(text) };
/** @type {any} */ (globalThis).draft = { uuid: "OPEN-DRAFT", hasTag: () => false };
/** @type {any} */ (globalThis).meesageFactory = (msgConfig) => ({
  compose(names) {
    this.names = names;
  },
  send() {
    sent.push({ type: msgConfig.type, names: this.names });
    return true;
  },
});

const roster = [
  "# Attendance: FU 2026 Winter",
  "[[BVR Coaching]]",
  "_For: 2026-11-07_",
  "- [x] Recorded",
  "- [ ] Submitted",
  "---",
  "",
  "- [x] Here Player (11)",
  "- [ ] Alex Smith (10)",
  "- [ ] Jordan Lee (12)",
].join("\n");

// Record Attendance's submit step for a fixture team, with the given absent
// names, prompt answers, and season (link). Returns what it did.
function recordAttendance(teamID, { names, promptResponses = {}, yesNo = {}, season = {}, dryRun = false }) {
  opened.length = 0;
  queued.length = 0;
  sent.length = 0;
  const ui = mockBVRUI(promptResponses, yesNo);
  const linksAsked = [];
  const bvr = {
    ui,
    teamSettingsFile: "../Tests/fixtures/bvr/teams-levels.json",
    globalTags: { hc_name: "Head Coach" },
    staff,
    attendanceOffice: "ATT",
    forms,
    levelSettings: (level) => levels[level],
    unpinDraft: () => {},
  };
  ServiceContainer.getInstance().register("bvr", () => bvr, true);
  const team = new Team(teamID);
  team.season = /** @type {any} */ ({
    currentSeasonData: { attendanceDraftID: "ROSTER" },
    ensureCurrentSeason: () => true,
    ensureFormURL: (formName) => {
      linksAsked.push(formName);
      return formLink;
    },
    ...season,
  });
  team.loadPracticePlan = () => {};

  const attendance = team.attendace;
  const rosterDraft = fakeDraft("ROSTER", roster);
  attendance.attendaceDraft = rosterDraft;
  attendance.names = names;
  attendance.submit({ dryRun });
  return { ui, rosterDraft, linksAsked };
}

// The entries of an opened form link, decoded, by entry ID.
function formEntries(url) {
  const query = `${url}`.split("?")[1] || "";
  const entries = {};
  query.split("&").forEach((pair) => {
    const [key, value] = pair.split("=");
    if (key.startsWith("entry.")) entries[key.slice(6)] = decodeURIComponent(value);
  });
  return entries;
}

const isSubmitted = (rosterDraft) => rosterDraft.content.includes("- [x] Submitted");
const fillWith = (unexcused) => ({ "Unexcused Absences": { button: "fill", fieldValues: { unexcused } } });
const saidYes = { "Attendance Form Submitted?": "yes" };

// Mixed absences, form submitted.
let run = recordAttendance("fixture-us", {
  names: ["Alex Smith", "Jordan Lee"],
  promptResponses: fillWith(["Jordan Lee"]),
  yesNo: saidYes,
});
test.assertDeepEqual(run.linksAsked, ["us-attendance"], "the form link comes from the season (asked once per term)");
test.assertEqual(opened.length, 1, "the form is opened once");
test.assert(opened[0]?.startsWith(`${formLink}/viewform?usp=pp_url&`), "as the prefilled viewform link");
test.assert(!opened[0]?.includes("formResponse") && !opened[0]?.includes("submit="), "and never posted");
test.assertDeepEqual(
  formEntries(opened[0]),
  { 59639440: "Head Coach", 151743401: "Fixture Varsity", 1275473467: "Alex Smith", 1652526151: "Jordan Lee" },
  "name, team, and the absences split by the coach's picks; the all-present box blank",
);
const unexcusedPrompt = run.ui.getInteractionsByType("buildMenu").find((i) => i.menuSettings.menuTitle == "Unexcused Absences");
test.assertDeepEqual(unexcusedPrompt?.menuSettings.menuItems.slice(-1)[0]?.data?.values, ["Alex Smith", "Jordan Lee"], "the prompt lists only the absent players");
test.assert(isSubmitted(run.rosterDraft), "a yes marks the draft submitted");
test.assertDeepEqual(queued, [{ action: "Mark Attendace As Complete", content: "FU" }], "and queues the completion shortcut");
test.assertDeepEqual(sent, [], "and no email is sent for US");

// Nobody absent: no unexcused prompt.
run = recordAttendance("fixture-us", { names: [], yesNo: saidYes });
test.assertDeepEqual(
  formEntries(opened[0]),
  { 59639440: "Head Coach", 151743401: "Fixture Varsity", 307654852: allPresent },
  "nobody absent checks the all-present box and leaves both lists blank",
);
test.assert(
  !run.ui.getInteractionsByType("buildMenu").some((i) => i.menuSettings.menuTitle == "Unexcused Absences"),
  "without asking about unexcused absences",
);
test.assert(isSubmitted(run.rosterDraft), "and is marked submitted on yes");

// Form not submitted.
run = recordAttendance("fixture-us", { names: ["Alex Smith"], promptResponses: fillWith([]) });
test.assertEqual(formEntries(opened[0])[1275473467], "Alex Smith", "an unmarked absence is excused");
test.assertEqual(run.rosterDraft.content, roster, "a no leaves the draft unsubmitted, to run again");
test.assertEqual(run.rosterDraft.updates, 0, "and unsaved");
test.assertDeepEqual(queued, [], "with no shortcut queued");
test.assert(
  run.ui.getInteractionsByType("appMessage").some((m) => m.message == "Attendance is not marked submitted. Run Record Attendance again to reopen the form."),
  "and says how to reopen the form",
);

// Unexcused prompt cancelled.
run = recordAttendance("fixture-us", { names: ["Alex Smith"], yesNo: saidYes });
test.assertDeepEqual(opened, [], "cancelling the unexcused prompt opens no form");
test.assertEqual(run.rosterDraft.content, roster, "and changes nothing");
test.assertDeepEqual(queued, [], "and queues nothing");

// No link given.
run = recordAttendance("fixture-us", { names: [], yesNo: saidYes, season: { ensureFormURL: () => undefined } });
test.assertDeepEqual(opened, [], "no link opens no form");
test.assertEqual(run.rosterDraft.content, roster, "and leaves the draft unsubmitted");
test.assert(
  run.ui.getInteractionsByType("appMessage").some((m) => m.message == "No US attendance link for this season, so attendance was not submitted."),
  "with a message saying why",
);

// No current season.
run = recordAttendance("fixture-us", { names: [], yesNo: saidYes, season: { ensureCurrentSeason: () => false } });
test.assertDeepEqual(run.linksAsked, [], "a team with no current season is not asked for a link");
test.assertDeepEqual(opened, [], "opens no form");
test.assertEqual(run.rosterDraft.content, roster, "and leaves the draft unsubmitted");

// Dry run.
run = recordAttendance("fixture-us", { names: ["Alex Smith"], promptResponses: fillWith([]), yesNo: saidYes, dryRun: true });
test.assert(opened[0]?.includes("/viewform?"), "a dry run still opens the prefilled form");
test.assert(isSubmitted(run.rosterDraft), "and marks the draft on yes");
test.assertDeepEqual(queued, [], "but queues no shortcut");

// Middle school: texts as before, no form.
run = recordAttendance("fixture-ms", { names: ["Alex Smith"], yesNo: saidYes });
test.assertDeepEqual(opened, [], "MS opens no form");
test.assertDeepEqual(run.linksAsked, [], "or asks for a link");
test.assertDeepEqual(sent, [{ type: "text", names: ["Alex Smith"] }], "MS texts the absences");
test.assert(isSubmitted(run.rosterDraft), "and marks the draft submitted");
test.assertDeepEqual(queued, [{ action: "Mark Attendace As Complete", content: "FM" }], "and queues the shortcut");

run = recordAttendance("fixture-ms", { names: [] });
test.assertDeepEqual(sent, [{ type: "text", names: [] }], "MS texts that no one is absent");

run = recordAttendance("fixture-ms", { names: ["Alex Smith"], dryRun: true });
test.assertDeepEqual(sent, [], "an MS dry run sends nothing");
test.assert(isSubmitted(run.rosterDraft), "and still marks the draft");

test.summary();
