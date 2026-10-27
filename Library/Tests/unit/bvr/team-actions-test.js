/**
 * Team Actions Unit Tests
 *
 * Characterization tests for Team actions the conventions refactor touches:
 * the template tags every team template gets (TmplSettings through a real
 * Team), the Things projects (Create Game Day Tasks, Create End of Season
 * Tasks), Update Roster, and Attendance's open-draft lookup. Teams come from
 * Library/Tests/fixtures/bvr/teams-levels.json; prompts use the real ui.yaml.
 *
 * Not covered here (needs Drafts): Template rendering the Things project and
 * the Things Parser action itself.
 */

require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/mocks.js");
require("../Tests/fixtures/bvr-stubs.js");
require("modules/cp/filesystems/CloudFS.js");
require("modules/bvr/utils/Staff.js");
require("modules/bvr/utils/TeamConfig.js");
require("modules/bvr/utils/TmplSettings.js");
require("modules/bvr/core/Game.js");
require("modules/bvr/core/Attendance.js");
require("modules/bvr/core/Team.js");

const test = new TestAssertions("Team actions");

// Stand-in for Template: records the settings it is given.
class RecordingTemplate {
  static basePath = "/Library/Templates";
  static made = [];

  constructor(settings) {
    this.settings = settings;
    this.draft = { uuid: `PROJECT-${RecordingTemplate.made.length + 1}` };
    RecordingTemplate.made.push(this);
  }
}

const queued = [];
const loadedInEditor = [];
/** @type {any} */ (globalThis).Template = RecordingTemplate;
/** @type {any} */ (globalThis).Action = { find: (name) => ({ name }) };
/** @type {any} */ (globalThis).app = { queueAction: (action, target) => queued.push({ action: action.name, draftID: target.uuid }) };
/** @type {any} */ (globalThis).Calendar = { find: () => undefined };
/** @type {any} */ (globalThis).adjustDate = (date) => date;
/** @type {any} */ (globalThis).editor = { load: (target) => loadedInEditor.push(target.uuid) };
/** @type {any} */ (globalThis).draft = { uuid: "OPEN-DRAFT", hasTag: () => false };

// A season standing in for Season: current, labeled, with a roster draft.
const stubSeason = (overrides = {}) => ({
  currentSeasonID: "2026-fall",
  currentSeasonLabel: "2026 Fall",
  currentSeasonData: { attendanceDraftID: "ROSTER" },
  currentSeasonRecord: [],
  ensureCurrentSeason: () => true,
  ...overrides,
});

// A real Team from the fixture, with a stub BVR and season.
function makeTeam(teamID, promptResponses = {}) {
  const ui = mockBVRUI(promptResponses);
  const bvr = {
    ui,
    teamSettingsFile: "../Tests/fixtures/bvr/teams-levels.json",
    globalTags: { hc_name: "Coach Test" },
    staff: new Staff({ ATT: { email: "attendance@example.com" } }),
    attendanceOffice: "ATT",
    forms: {},
    levelSettings: () => ({}),
    formatDateMDY: () => "10-21-2026",
    formatDateYMD: () => "2026-10-21",
  };
  ServiceContainer.getInstance().register("bvr", () => bvr, true);
  const team = new Team(teamID);
  team.season = stubSeason();
  return { team, ui };
}

const infoMessages = (ui) =>
  ui.getInteractionsByType("appMessage").filter((m) => m.messageType == "info").map((m) => m.message);

// The level tags apart from the rest, so a check of the rest does not depend
// on whether the other level's tag is false or missing (Mustache treats both
// as off).
function splitLevelTags(templateTags) {
  const { level_ms, level_us, ...rest } = templateTags;
  return { level_ms, level_us, rest };
}

// An object with its keys sorted, so a comparison ignores key order.
const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));

// --- template tags ---
test.section("template tags");

// Create End of Season Tasks hands Template the tags every team template gets.
RecordingTemplate.made = [];
queued.length = 0;
let { team, ui } = makeTeam("fixture-ms");
team.createEndOfSeasonTasks();
let made = RecordingTemplate.made[0]?.settings;
let tags = splitLevelTags(made?.templateTags || {});
test.assertEqual(tags.level_ms, true, "an ms team gets level_ms");
test.assertFalsy(tags.level_us, "and not level_us");
test.assertDeepEqual(
  Object.keys(tags.rest).sort(),
  [
    "attendance_email", "current_season", "current_season_label", "game_comments", "game_date", "game_description",
    "game_highlights", "game_isHome", "game_location", "game_opponent", "game_report_due_date", "game_result",
    "game_score", "game_score_them", "game_score_us", "game_summary", "hc_name", "team_abbr", "team_name",
  ],
  "the rest of the tag set: global and team tags, team, season, and game tags",
);
test.assertDeepEqual(
  sorted(tags.rest),
  sorted({
    hc_name: "Coach Test",
    attendance_email: "attendance@example.com",
    team_name: "Fixture MS",
    team_abbr: "FM",
    current_season: "2026-fall",
    current_season_label: "2026 Fall",
  }),
  "with these values (the game tags are undefined without a game)",
);
test.assertDeepEqual(made?.draftTags, ["bvr/fixture/ms"], "tagged with the team's default tag");

({ team, ui } = makeTeam("fixture-us"));
RecordingTemplate.made = [];
team.createEndOfSeasonTasks();
tags = splitLevelTags(RecordingTemplate.made[0]?.settings?.templateTags || {});
test.assertEqual(tags.level_us, true, "a us team gets level_us");
test.assertFalsy(tags.level_ms, "and not level_ms");

// --- Things projects ---
test.section("Things projects");

RecordingTemplate.made = [];
queued.length = 0;
({ team, ui } = makeTeam("fixture-us"));
team.createEndOfSeasonTasks();
made = RecordingTemplate.made[0]?.settings;
test.assertEqual(made?.templateFile, "bvr/end-of-season-project.mustache", "End of Season Tasks renders the default end-of-season project");
test.assertDeepEqual(made?.draftTags, ["bvr/fixture/us"], "tagged for the team");
test.assertDeepEqual(queued, [{ action: "Things Parser", draftID: "PROJECT-1" }], "and queues Things Parser on the new draft");

RecordingTemplate.made = [];
queued.length = 0;
({ team, ui } = makeTeam("fixture-ms", {
  "Day of Game": { button: "today", fieldValues: {} },
  "Name of Opponent": { button: "ok", fieldValues: { opponent: "Old Rivals" } },
  "Location of Game": { button: "Away", fieldValues: {} },
}));
team.createGameDayTasks();
made = RecordingTemplate.made[0]?.settings;
test.assertEqual(made?.templateFile, "bvr/fixture-ms-game-day-project.mustache", "Game Day Tasks renders the team's game-day project");
test.assertDeepEqual(made?.draftTags, ["bvr/fixture/ms"], "tagged for the team");
tags = splitLevelTags(made?.templateTags || {});
test.assertDeepEqual(
  sorted(tags.rest),
  sorted({
    hc_name: "Coach Test",
    attendance_email: "attendance@example.com",
    team_name: "Fixture MS",
    team_abbr: "FM",
    current_season: "2026-fall",
    current_season_label: "2026 Fall",
    game_date: "10-21-2026",
    game_report_due_date: "10-21-2026",
    game_location: "Away",
    game_isHome: false,
    game_opponent: "Old Rivals",
    game_description: "Away vs Old Rivals (10-21-2026)",
    game_summary: "No game recorded.",
    game_highlights: "",
    game_comments: "",
    game_score_us: "",
    game_score_them: "",
  }),
  "with the game's date, opponent, and location from the prompts",
);
test.assertEqual(tags.level_ms, true, "and the level tag");
test.assertDeepEqual(
  ui.getInteractionsByType("buildMenu").map((i) => i.menuSettings.menuTitle),
  ["Day of Game", "Name of Opponent", "Location of Game"],
  "asking for the day, opponent, and location",
);
test.assertDeepEqual(queued, [{ action: "Things Parser", draftID: "PROJECT-1" }], "and queues Things Parser on the new draft");

RecordingTemplate.made = [];
queued.length = 0;
({ team, ui } = makeTeam("fixture-us"));
team.createGameDayTasks();
test.assert(infoMessages(ui).includes("No game day tasks found."), "a team without a game-day project says so");
test.assertEqual(RecordingTemplate.made.length + queued.length, 0, "and makes nothing");

// --- Update Roster ---
test.section("Update Roster");

const roster = (title) =>
  fakeDraft("ROSTER", [title, "[[BVR Coaching]]", "_For: 2026-10-20_", "- [x] Recorded", "- [x] Submitted", "---", "", "- [ ] Synthetic Player (7)"].join("\n"));
const verify = (button) => ({ "Please Verify": { button, fieldValues: {} } });
function updateRosterWith(rosterDraft, promptResponses = {}) {
  ({ team, ui } = makeTeam("fixture-ms", promptResponses));
  /** @type {any} */ (globalThis).Draft = { find: (uuid) => (uuid == "ROSTER" ? rosterDraft : undefined) };
  loadedInEditor.length = 0;
  team.updateRoster();
}

let rosterDraft = roster("# Attendance: FM 2025 Fall");
updateRosterWith(rosterDraft, verify("yes"));
const verifyPrompt = ui.getInteractionsByType("buildMenu")[0]?.menuSettings;
test.assertEqual(verifyPrompt?.menuItems.slice(-1)[0]?.data?.label?.split("\n")[0], "# Attendance: FM 2026 Fall", "last season's roster is shown retitled for the current season");
test.assertEqual(rosterDraft.lines[0], "# Attendance: FM 2026 Fall", "and on yes the title is updated");
test.assertEqual(rosterDraft.lines.slice(-1)[0], "- [ ] Synthetic Player (8)", "everyone moves up a grade");
test.assertEqual(rosterDraft.updates, 1, "the draft is saved");
test.assertDeepEqual(loadedInEditor, ["ROSTER"], "and loaded in the editor");

rosterDraft = roster("# Attendance: FM 2025 Fall");
updateRosterWith(rosterDraft, verify("no"));
test.assertEqual(rosterDraft.updates, 0, "on no, the roster is left alone");

// The title Start New Season gives a roster draft for this season (see
// season-storage-test.js) matches, so it is not updated twice.
rosterDraft = roster("# Attendance: FM 2026 Fall");
updateRosterWith(rosterDraft, verify("yes"));
test.assert(infoMessages(ui).includes("Roster has already been updated!"), "a roster titled \"# Attendance: <ABBR> <label>\" is already updated");
test.assertEqual(ui.getInteractionsByType("buildMenu").length, 0, "without a prompt");
test.assertEqual(rosterDraft.updates, 0, "or a save");

updateRosterWith(undefined);
test.assert(
  ui.getInteractionsByType("appMessage").some((m) => m.messageType == "error" && m.message == "Fixture MS has no roster draft."),
  "a missing roster draft is an error",
);

// --- Attendance open-draft lookup ---
test.section("Attendance open-draft lookup");

const openRoster = fakeDraft("ROSTER", "# open");
const foundRoster = fakeDraft("ROSTER", "# found");
/** @type {any} */ (globalThis).Draft = { find: (uuid) => (uuid == "ROSTER" ? foundRoster : undefined) };
({ team } = makeTeam("fixture-ms"));
/** @type {any} */ (globalThis).draft = openRoster;
test.assertEqual(new Attendance(team.dependencies).loadDraft(), openRoster, "the open draft is used when it is the roster");
/** @type {any} */ (globalThis).draft = fakeDraft("OTHER", "# other");
test.assertEqual(new Attendance(team.dependencies).loadDraft(), foundRoster, "otherwise the roster comes from Draft.find");

// --- Bus Ride Home ---
test.section("Bus Ride Home");

const attendanceTaken = (date, submitted = "x") =>
  [
    "# Attendance: FM 2026 Fall",
    "[[BVR Coaching]]",
    `_For: ${date}_`,
    "- [x] Recorded",
    `- [${submitted}] Submitted`,
    "---",
    "",
    "- [x] Here Player (7)",
    "- [ ] Absent Player (8)",
  ].join("\n");

const busList = Attendance.flipBusList(attendanceTaken("2026-10-21"));
test.assertEqual(busList.split("\n")[2], "_For: 2026-10-21 · Bus home_", "the date line is marked as the bus list");
test.assertDeepEqual(busList.split("\n").slice(3, 5), ["- [x] Recorded", "- [x] Submitted"], "Recorded and Submitted are left checked");
test.assertDeepEqual(
  busList.split("\n").slice(-2),
  ["- [ ] Here Player (7)", "- [x] Absent Player (8)"],
  "players who were here are unchecked, absent players are checked",
);
test.assertEqual(Attendance.flipBusList(busList), attendanceTaken("2026-10-21"), "flipping again restores today's attendance");

const editorText = [];
/** @type {any} */ (globalThis).editor = { load: () => {}, setText: (text) => editorText.push(text) };
function busRideHomeWith(attendanceDraft) {
  /** @type {any} */ (globalThis).draft = { uuid: "OPEN-DRAFT", hasTag: () => false };
  ({ team, ui } = makeTeam("fixture-ms"));
  /** @type {any} */ (globalThis).draft = attendanceDraft;
  editorText.length = 0;
  team.toggleBusList();
}

let busDraft = fakeDraft("ROSTER", attendanceTaken("2026-10-21"));
busRideHomeWith(busDraft);
test.assertEqual(busDraft.lines[8], "- [x] Absent Player (8)", "Bus Ride Home flips today's submitted attendance");
test.assertEqual(busDraft.updates, 1, "the draft is saved");
test.assertDeepEqual(editorText, [busDraft.content], "and the editor shows the same text");
test.assert(infoMessages(ui).includes("Bus list: checked players are not riding the bus."), "and says it is now the bus list");
busRideHomeWith(busDraft);
test.assert(infoMessages(ui).includes("Back to today's attendance."), "running it again says it is back to attendance");

for (const [label, content] of [
  ["attendance not yet submitted", attendanceTaken("2026-10-21", " ")],
  ["attendance submitted on an earlier day", attendanceTaken("2026-10-20")],
]) {
  busDraft = fakeDraft("ROSTER", content);
  busRideHomeWith(busDraft);
  test.assertEqual(busDraft.content, content, `${label}: the draft is left alone`);
  test.assert(infoMessages(ui).includes("Submit today's attendance before making the bus list."), `${label}: and says to submit first`);
}

test.summary();
