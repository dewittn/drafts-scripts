/**
 * Season Storage Unit Tests
 *
 * Covers how Season picks between the team file and the old records.json /
 * practicePlans.json, the two stores themselves, PracticePlan's week keys,
 * and the Start New Season prompt. All data is synthetic: the team file comes
 * from Library/Tests/fixtures/bvr/, everything else is built here.
 *
 * Not covered here (needs Drafts): creating a brand-new team file on disk,
 * appending rows to a real season record draft, and the date picker itself.
 */

require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/mocks.js");
require("modules/cp/filesystems/CloudFS.js");
require("modules/bvr/core/Season.js");
require("modules/bvr/core/PracticePlan.js");
require("modules/bvr/core/Game.js");
require("modules/bvr/utils/TmplSettings.js");
require("modules/bvr/services/GoogleForm.js");
require("modules/bvr/utils/Staff.js");
require("modules/bvr/core/Team.js");
require("modules/bvr/storage/TeamFileStore.js");
require("modules/bvr/storage/LegacySeasonStore.js");
require("modules/bvr/storage/FormLinkStore.js");

const test = new TestAssertions("Season storage");

const teamFixturePath = "../Tests/fixtures/bvr/team-file.json";
const missingTeamFilePath = "../Tests/fixtures/bvr/no-such-team.json";
const thisYear = new Date().getFullYear();

// Stand-in for Template: records what it was asked to render. Installed as
// the global Season looks up, since the real Template needs Drafts.
class StubTemplate {
  static rendered = [];

  constructor(settings) {
    this.settings = settings;
    const isRoster = settings.templateFile == "bvr/attendance.md";
    this.draftID = isRoster ? "NEW-ROSTER-DRAFT" : "NEW-RECORD-DRAFT";
    // The first lines of bvr/attendance.md, for the roster draft.
    this.draft = {
      uuid: this.draftID,
      content: isRoster ? "# Attendance: \n[[bear:MOC: BVR Coaching]]\n_For: 2023-11-02_\n- [ ] Recorded" : "",
    };
    StubTemplate.rendered.push(settings);
  }

  archive() {
    return this;
  }

  save() {
    return this;
  }
}
/** @type {any} */ (globalThis).Template = StubTemplate;

// Stand-in for Draft.find, for roster draft titles.
/** @type {any} */ (globalThis).Draft = { find: (uuid) => ({ uuid, displayTitle: `Roster ${uuid}` }) };

// A copy of plain data with a save() that counts calls, standing in for DataFile.
function savable(data) {
  const file = JSON.parse(JSON.stringify(data));
  Object.defineProperty(file, "saves", { value: 0, writable: true, enumerable: false });
  Object.defineProperty(file, "save", {
    value() {
      this.saves++;
    },
    enumerable: false,
  });
  return file;
}

function teamFixture() {
  return savable(DataFile.load(teamFixturePath));
}

// The startNewSeason, formURLPrompt, and editSeason entries from Library/Data/bvr/ui.yaml.
const uiSettings = {
  editSeason: {
    labelField: { type: "textField", data: { name: "label", label: "Name" } },
    startDateField: { type: "datePicker", data: { name: "startDate", label: "First Day" } },
    hasEndDateField: { type: "switch", data: { name: "hasEndDate", label: "Has a last day" } },
    endDateField: { type: "datePicker", data: { name: "endDate", label: "Last Day" } },
    formField: { type: "textField", data: { options: { keyboard: "url" } } },
    attendanceField: { type: "textField", data: { name: "attendance", label: "Attendance messages to" } },
    gameReportField: { type: "textField", data: { name: "gameReport", label: "Score messages to" } },
    rosterLabel: { type: "label", data: { name: "roster" } },
    newRosterField: { type: "switch", data: { name: "newRoster", label: "Start a new roster draft" } },
    menuSettings: {
      menuTitle: "Edit Season",
      menuMessage: "Change this season.",
      menuItems: [{ type: "button", data: { name: "Save", value: "save" } }],
    },
    startDateWarning: { menuTitle: "Change the first day?", menuMessage: "Weeks count from the first day." },
    clearLinksPrompt: { menuTitle: "Clear form links?", menuMessage: "These form links were left blank." },
  },
  recipientsPrompt: {
    attendanceField: { type: "textField", data: { name: "attendance", label: "Attendance messages to" } },
    gameReportField: { type: "textField", data: { name: "gameReport", label: "Score messages to" } },
    menuSettings: {
      menuTitle: "Who Gets Messages",
      menuMessage: "Initials, separated by commas.",
      menuItems: [{ type: "button", data: { name: "Save", value: "save" } }],
    },
  },
  attendanceDraftPrompt: {
    menuSettings: {
      menuTitle: "Roster Draft",
      menuMessage: "Keep or start a new one?",
      menuItems: [
        { type: "button", data: { name: "Keep", value: "keep" } },
        { type: "button", data: { name: "Start a New One", value: "new" } },
      ],
    },
  },
  formURLPrompt: {
    urlField: { type: "textField", data: { name: "url", label: "Form link" } },
    menuSettings: {
      menuTitle: "Score Report Form",
      menuMessage: "Paste this season's link to the form.",
      menuItems: [{ type: "button", data: { name: "Save", value: "save" } }],
    },
  },
  startNewSeason: {
    seasonIDField: { type: "textField", data: { name: "seasonID", label: "Season" } },
    startDateField: { type: "datePicker", data: { name: "startDate", label: "First Day", options: { mode: "date" } } },
    menuSettings: {
      menuTitle: "Start New Season",
      menuMessage: "Name the season and pick its first day.",
      menuItems: [{ type: "button", data: { name: "Start Season", value: "start" } }],
    },
  },
};

// yesNo: answers to yesNoPrompt by menu title ("yes" or "no"); unlisted is "no".
function mockUI(promptResponses = {}, yesNo = {}) {
  /** @type {any} */
  const ui = new MockUI({ promptResponses });
  ui.settings = (name) => JSON.parse(JSON.stringify(uiSettings[name]));
  ui.yesNoPrompt = (menuSettings) => {
    ui.interactions.push({ type: "yesNo", menuSettings });
    return yesNo[menuSettings.menuTitle] || "no";
  };
  return ui;
}

const pad = (value) => `${value}`.padStart(2, "0");

function mockBVR(teamFilePath, ui = mockUI()) {
  return {
    ui,
    globalTags: {},
    recordsFile: "../Tests/fixtures/bvr/no-records.json",
    ppData: savable({}),
    staff: new Staff({ AG: { cell: "555-0101" }, HM: { cell: "555-0102" }, WK: { cell: "555-0103" }, AN: { cell: "555-0104" } }),
    pinned: [],
    pinDraft(workingDraft) {
      this.pinned.push(workingDraft.uuid);
    },
    draftsCreated: 0,
    createDraftFromTemplate() {
      this.draftsCreated++;
    },
    teamFilePath: () => teamFilePath,
    formatDateYMD: (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  };
}

// A team wired the way Team.dependencies wires Season and PracticePlan.
function mockTeam(bvr, overrides = {}) {
  const team = {
    id: "test-team",
    name: "Test Team",
    abbr: "TT",
    startDate: "2026-08-31",
    seasonName: "fall",
    defaultTag: "bvr/test",
    linksFile: null,
    formNames: ["varsity-score-report"],
    defaultRecipients: { attendance: ["AG", "HM"], gameReport: ["AG", "WK"] },
    attendanceDraftID: undefined,
    form: (name) => ({ name, title: name == "varsity-score-report" ? "Varsity score report" : "MS score report" }),
    gameReportSettings: {
      googleFormSettings: [
        { name: "ms-score-report", title: "MS score report", postData: true, fields: [] },
        { name: "varsity-score-report", title: "Varsity score report", postData: false, fields: [] },
      ],
    },
    dependencies: null,
    season: null,
    ...overrides,
  };
  Object.defineProperty(team, "gblTmplSettings", {
    get() {
      return {
        teamName: team.name,
        teamAbbr: team.abbr,
        defaultDraftTags: [team.defaultTag],
        globalTemplateTags: {},
        teamTemplateTags: {},
        currentSeasonID: team.season.currentSeasonID,
        currentSeasonLabel: team.season.currentSeasonLabel,
      };
    },
  });
  team.dependencies = { bvr, team, tmplSettings: { seasonRecord: { templateFile: "bvr/game-season-record.md" } } };
  team.season = new Season(team.dependencies);
  team.linksFile = savable({ schemaVersion: 1, terms: {} });
  team.season.formLinks = new FormLinkStore(team.linksFile);
  return team;
}

const infoMessages = (ui) =>
  ui.getInteractionsByType("appMessage").filter((m) => m.messageType == "info").map((m) => m.message);

// A game as Season.updateWith sees it: appended already, so no draft is touched.
function fakeGame(draftID, result = "Win") {
  return {
    draftID,
    appended: true,
    tmplSettingsRecordRow: {},
    toJSON() {
      return { draftID, result, appended: true };
    },
  };
}

// --- storage selection ---
test.section("storage selection");

let bvr = mockBVR(teamFixturePath);
let team = mockTeam(bvr);
test.assertEqual(team.season.usesTeamFile, true, "uses the team file when it exists");
test.assertEqual(team.season.currentSeasonID, "2026-fall", "season ID comes from currentSeason");
test.assertEqual(team.season.currentSeasonLabel, "2026 Fall", "label comes from the season entry");
test.assertEqual(team.season.currentSeasonRecord.length, 2, "games come from the current season only");
test.assertEqual(team.season.seasonRecordDraftID, "REC-2026-FALL", "season record draft comes from the entry");
test.assertEqual(team.season.startDate, "2026-09-07", "start date comes from the entry");
test.assertDeepEqual(infoMessages(bvr.ui), [], "no migration message for a migrated team");

bvr = mockBVR(missingTeamFilePath);
team = mockTeam(bvr);
test.assertEqual(team.season.usesTeamFile, false, "falls back to the old files without a team file");
test.assertEqual(team.season.currentSeasonID, thisYear, "old files keep the calendar year as the season");
test.assertEqual(team.season.currentSeasonLabel, `${thisYear}`, "old files label the season with the year");
test.assertEqual(team.season.startDate, "2026-08-31", "old files use the start date from teams.yaml");
team.season.currentSeasonRecord;
const messages = infoMessages(bvr.ui);
test.assertEqual(messages.length, 1, "shows the not-migrated message once per run");
test.assert(messages[0].includes("has not been migrated"), "message says the team has not been migrated");

// --- TeamFileStore ---
test.section("TeamFileStore");

let file = teamFixture();
let store = new TeamFileStore(file);
test.assertEqual(store.practicePlanKey("W4"), "W4", "practice plans are keyed by week alone");
store.savePracticePlan("W4", "PLAN-4");
test.assertDeepEqual(file.seasons["2026-fall"].practicePlans, { W1: "PLAN-1", W4: "PLAN-4" }, "plan saved in the current season");
test.assertEqual(file.saves, 1, "saving a plan writes the team file");

store.setCurrentSeason("2025-fall");
test.assertEqual(store.seasonRecordDraftID, undefined, "an empty season record draft ID reads as none");
test.assertEqual(store.startDate, undefined, "a null start date reads as none");
test.assertDeepEqual(store.practicePlans, { W3: "OLD-PLAN" }, "plans follow the current season");

test.assertEqual(store.hasSeason("2026-winter"), false, "hasSeason is false for an unknown season");
store.addSeason("2026-winter", { startDate: "2026-11-16" });
test.assertEqual(store.hasSeason("2026-winter"), true, "addSeason creates the entry");
test.assertDeepEqual(
  Object.keys(file.seasons["2026-winter"]),
  ["label", "startDate", "endDate", "formURLs", "recipients", "attendanceDraftID", "seasonRecordDraftID", "games", "practicePlans"],
  "a new entry has every schema key",
);
test.assertEqual(file.seasons["2026-winter"].label, "2026 Winter", "a new entry is labeled from its ID");
test.assertEqual(TeamFileStore.seasonLabel("2026-27"), "2026-27", "an unusual ID is its own label");

store = new TeamFileStore(savable({ schemaVersion: 1, teamID: "x", currentSeason: null, seasons: {} }));
test.assertDeepEqual(store.games, [], "no current season means no games");
test.assertEqual(store.label, null, "no current season means no label");

file = teamFixture();
store = new TeamFileStore(file);
test.assertDeepEqual(store.formURLs, {}, "a season with the old formURL: null has no form URLs");
store.saveFormURL("varsity-score-report", "https://docs.google.com/forms/d/e/VARSITY");
test.assertDeepEqual(
  file.seasons["2026-fall"].formURLs,
  { "varsity-score-report": "https://docs.google.com/forms/d/e/VARSITY" },
  "saveFormURL stores the URL by form name in the current season",
);
test.assertEqual("formURL" in file.seasons["2026-fall"], false, "and drops the old null formURL key");
test.assertEqual(file.saves, 1, "and saves the team file");

// --- LegacySeasonStore ---
test.section("LegacySeasonStore");

let loads = 0;
const legacyRecords = savable({
  "test-team": {
    2024: [{ draftID: "BARE" }],
    2026: { seasonRecordDraftID: "REC-2026", seasonRecordData: [{ draftID: "L-1" }] },
  },
});
const legacyPlans = savable({ "test-team": { "2026W2": "LP-2" } });
const legacy = (year, records = legacyRecords, plans = legacyPlans) =>
  new LegacySeasonStore({
    teamID: "test-team",
    year,
    startDate: "2026-03-02",
    loadRecords: () => {
      loads++;
      return records;
    },
    loadPracticePlans: () => plans,
  });

const legacyStore = legacy(2026);
test.assertEqual(loads, 0, "records load on first use, not on construction");
test.assertEqual(legacyStore.games.length, 1, "games come from seasonRecordData");
test.assertEqual(loads, 1, "records load once");
test.assertEqual(legacyStore.seasonRecordDraftID, "REC-2026", "season record draft ID from records.json");
test.assertEqual(legacyStore.practicePlanKey("W2"), "2026W2", "practice plans are keyed by year and week");
test.assertEqual(legacyStore.practicePlans["2026W2"], "LP-2", "reads plans from practicePlans.json");
legacyStore.savePracticePlan("2026W3", "LP-3");
test.assertEqual(legacyPlans["test-team"]["2026W3"], "LP-3", "saves plans into practicePlans.json");
test.assertEqual(legacyPlans.saves, 1, "saving a plan writes practicePlans.json");
test.assertDeepEqual(legacy(2024).games, [], "a bare-array season shows no games, as before");
test.assertEqual(legacyStore.hasTeamData, true, "hasTeamData sees the team's records");
test.assertEqual(legacy(2026, savable({}), savable({})).hasTeamData, false, "hasTeamData is false for a new team");

const linkRecords = savable({ "test-team": { 2026: { seasonRecordDraftID: "R", seasonRecordData: [] } } });
const linkStore = legacy(2026, linkRecords);
test.assertDeepEqual(linkStore.formURLs, {}, "an unmigrated season starts with no form links");
linkStore.saveFormURL("varsity-score-report", "https://docs.google.com/forms/d/e/OLD");
test.assertDeepEqual(
  linkRecords["test-team"][2026].formURLs,
  { "varsity-score-report": "https://docs.google.com/forms/d/e/OLD" },
  "an unmigrated team keeps form links on its records.json season",
);
test.assertEqual(linkRecords.saves, 1, "and saves records.json");

// --- Season.updateWith ---
test.section("Season.updateWith");

bvr = mockBVR(teamFixturePath);
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
team.season.updateWith(fakeGame("GAME-3"));
test.assertDeepEqual(
  file.seasons["2026-fall"].games.map((g) => g.draftID),
  ["GAME-1", "GAME-2", "GAME-3"],
  "a new game is added to the current season",
);
team.season.updateWith(fakeGame("GAME-1", "Draw"));
test.assertEqual(file.seasons["2026-fall"].games.length, 3, "an existing game is replaced, not duplicated");
test.assertEqual(file.seasons["2026-fall"].games[0].result, "Draw", "the replacement holds the new data");
test.assertEqual(file.seasons["2025-fall"].games.length, 1, "other seasons are untouched");
test.assertEqual(file.saves, 2, "each update writes the team file");

file = savable({ schemaVersion: 1, teamID: "test-team", currentSeason: null, seasons: {} });
team.season.store = new TeamFileStore(file);
team.season.updateWith(fakeGame("GAME-4"));
test.assertEqual(file.saves, 0, "no current season: nothing is saved");
test.assert(
  bvr.ui.getInteractionsByType("appMessage").some((m) => m.messageType == "error" && m.message.includes("Start New Season")),
  "no current season: says to run Start New Season",
);

// --- PracticePlan ---
test.section("PracticePlan");

test.assertEqual(PracticePlan.weekNumber("2026-09-07", new Date(2026, 8, 7)), 1, "start day is week 1");
test.assertEqual(PracticePlan.weekNumber("2026-09-07", new Date(2026, 8, 13)), 1, "the Sunday after is still week 1");
test.assertEqual(PracticePlan.weekNumber("2026-09-07", new Date(2026, 9, 18)), 6, "Oct 18 is week 6");
test.assertEqual(PracticePlan.weekNumber("2026-11-16", new Date(2027, 0, 4)), 8, "weeks keep counting into January");
test.assertEqual(PracticePlan.weekNumber("2026-11-16", new Date(2026, 10, 9)), 0, "the week before the start is week 0");

bvr = mockBVR(teamFixturePath);
team = mockTeam(bvr);
let plan = new PracticePlan(team.dependencies);
const week = PracticePlan.weekNumber("2026-09-07");
test.assertEqual(plan.teamStartDate, "2026-09-07", "week counts from the season's start date");
test.assertEqual(plan.planID, `W${week}`, "team file plan IDs are W<week>");
test.assertDeepEqual(plan.practicePlans, { W1: "PLAN-1" }, "plans come from the current season");

file = teamFixture();
file.seasons["2026-fall"].startDate = null;
team.season.store = new TeamFileStore(file);
test.assertEqual(new PracticePlan(team.dependencies).teamStartDate, "2026-08-31", "no season start date falls back to teams.yaml");

bvr = mockBVR(missingTeamFilePath);
team = mockTeam(bvr);
plan = new PracticePlan(team.dependencies);
test.assertEqual(plan.planID, `${thisYear}W${PracticePlan.weekNumber("2026-08-31")}`, "old files keep <year>W<week>");

// --- Start New Season ---
test.section("Start New Season");

const startResponse = (seasonID) => ({
  "Start New Season": { button: "start", fieldValues: { seasonID, startDate: new Date(2026, 10, 16) } },
});

bvr = mockBVR(teamFixturePath, mockUI(startResponse(" 2026-winter ")));
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
StubTemplate.rendered = [];
team.season.startNewSeason();
const menu = bvr.ui.getInteractionsByType("buildMenu")[0]?.menuSettings;
test.assertEqual(menu?.menuItems[1]?.data?.initialText, `${thisYear}-fall`, "suggests <year>-<season> from teams.yaml");
test.assertEqual(menu?.menuItems[2]?.data?.initialDate?.getDay(), 1, "suggests a Monday as the first day");
test.assertEqual(file.currentSeason, "2026-winter", "the new season becomes current");
test.assertEqual(file.seasons["2026-winter"]?.startDate, "2026-11-16", "stores the picked start date");
test.assertEqual(file.seasons["2026-winter"]?.seasonRecordDraftID, "NEW-RECORD-DRAFT", "stores the new season record draft");
test.assertEqual(file.seasons["2026-fall"].games.length, 2, "the previous season keeps its games");
test.assert(file.saves >= 1, "the team file is saved");
test.assertEqual(StubTemplate.rendered[0]?.templateTags?.current_season, "2026-winter", "record draft gets the season ID tag");
test.assertEqual(StubTemplate.rendered[0]?.templateTags?.current_season_label, "2026 Winter", "record draft gets the label tag");

bvr = mockBVR(teamFixturePath, mockUI(startResponse("2026-fall")));
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
team.season.startNewSeason();
test.assertEqual(file.saves, 0, "an existing season is refused without saving");
test.assertEqual(file.currentSeason, "2026-fall", "refusing leaves the current season alone");
test.assert(infoMessages(bvr.ui).some((m) => m.includes("already has a 2026-fall season")), "says the season exists");

bvr = mockBVR(teamFixturePath, mockUI(startResponse("   ")));
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
team.season.startNewSeason();
test.assertEqual(file.saves, 0, "a blank season name changes nothing");

bvr = mockBVR(teamFixturePath, mockUI());
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
team.season.startNewSeason();
test.assertEqual(file.saves, 0, "cancelling the prompt changes nothing");

bvr = mockBVR(missingTeamFilePath, mockUI(startResponse("2026-winter")));
team = mockTeam(bvr);
team.season.store = legacy(2026);
team.season.startNewSeason();
test.assertEqual(bvr.ui.getInteractionsByType("buildMenu").length, 0, "an unmigrated team with history keeps the old flow");

// A season bvr:migrate created from teams.yaml: no record draft yet.
function teamFixtureWithWinter(startDate = null) {
  const winterFile = teamFixture();
  winterFile.seasons["2026-winter"] = TeamFileStore.emptySeason("2026-winter");
  winterFile.seasons["2026-winter"].startDate = startDate;
  return winterFile;
}

bvr = mockBVR(teamFixturePath, mockUI(startResponse("2026-winter")));
team = mockTeam(bvr);
file = teamFixtureWithWinter();
team.season.store = new TeamFileStore(file);
StubTemplate.rendered = [];
team.season.startNewSeason();
test.assertEqual(file.currentSeason, "2026-winter", "an existing season without a draft becomes current");
test.assertEqual(file.seasons["2026-winter"].seasonRecordDraftID, "NEW-RECORD-DRAFT", "and gets its record draft");
test.assertEqual(file.seasons["2026-winter"].startDate, "2026-11-16", "and takes the prompted start date when it has none");
test.assert(file.saves >= 1, "and is saved");
test.assertEqual(StubTemplate.rendered[0]?.templateTags?.current_season, "2026-winter", "the draft is for that season");
test.assert(!infoMessages(bvr.ui).some((m) => m.includes("already has")), "is not reported as already existing");

bvr = mockBVR(teamFixturePath, mockUI(startResponse("2026-winter")));
team = mockTeam(bvr);
file = teamFixtureWithWinter("2026-11-23");
team.season.store = new TeamFileStore(file);
team.season.startNewSeason();
test.assertEqual(file.seasons["2026-winter"].startDate, "2026-11-23", "an existing start date is kept");

bvr = mockBVR(teamFixturePath, mockUI(startResponse("2025-fall")));
team = mockTeam(bvr);
file = teamFixture();
file.seasons["2025-fall"].seasonRecordDraftID = "REC-2025-FALL";
file.seasons["2025-fall"].startDate = "2025-09-01";
team.season.store = new TeamFileStore(file);
StubTemplate.rendered = [];
team.season.startNewSeason();
test.assertEqual(file.currentSeason, "2025-fall", "an existing season with a draft is made current");
test.assertEqual(StubTemplate.rendered.length, 0, "without a second record draft");
test.assertEqual(file.saves, 1, "and the switch is saved");
test.assert(infoMessages(bvr.ui).some((m) => m.includes("now the current season")), "says it is now current");

// --- season without a start date ---
test.section("season without a start date");

bvr = mockBVR(teamFixturePath);
team = mockTeam(bvr, { startDate: undefined });
file = teamFixture();
file.seasons["2026-fall"].startDate = null;
team.season.store = new TeamFileStore(file);
test.assertDoesNotThrow(() => new PracticePlan(team.dependencies).create(), "Create Practice Plan does not throw");
test.assertDoesNotThrow(() => new PracticePlan(team.dependencies).load(), "Load Practice Plan does not throw");
test.assertEqual(bvr.draftsCreated, 0, "no plan draft is created");
test.assertEqual(
  infoMessages(bvr.ui).filter((m) => m.includes("has no start date")).length,
  2,
  "each says the season has no start date",
);

// --- unusable team file ---
test.section("unusable team file");

bvr = mockBVR("../Tests/fixtures/bvr/team-file-half-synced.json");
team = mockTeam(bvr);
test.assertThrows(() => team.season.currentSeasonRecord, "a half-synced team file stops the action", "cannot be used");
test.assert(
  bvr.ui.getInteractionsByType("appMessage").some((m) => m.messageType == "error" && m.message.includes("Nothing was changed")),
  "shows an error saying nothing was changed",
);
test.assertDeepEqual(infoMessages(bvr.ui), [], "does not fall back to records.json");

file = savable({ teamID: "test-team", seasons: {} });
test.assertThrows(() => new TeamFileStore(file).save(), "refuses to save a file that would not load back", "not saved");
test.assertEqual(file.saves, 0, "nothing was written");

// --- no current season ---
test.section("no current season");

const noSeasonFile = () => savable({ schemaVersion: 1, teamID: "test-team", currentSeason: null, seasons: {} });

bvr = mockBVR(teamFixturePath);
team = mockTeam(bvr);
team.season.store = new TeamFileStore(noSeasonFile());
new PracticePlan(team.dependencies).create();
test.assertEqual(bvr.draftsCreated, 0, "Create Practice Plan makes no draft");
new PracticePlan(team.dependencies).load();
const game = new Game(team.dependencies, "ANY-DRAFT");
game.recordResult();
test.assertEqual(game.recorded, false, "Record Game Score records nothing");
test.assertEqual(bvr.ui.getInteractionsByType("buildMenu").length, 0, "no prompt appears before the check");
test.assertEqual(
  bvr.ui.getInteractionsByType("appMessage").filter((m) => m.message.includes("Run Start New Season first")).length,
  3,
  "each says to run Start New Season",
);

// TmplSettings' constructor returns a plain settings object.
/** @type {any} */
const noSeasonSettings = new TmplSettings(
  { currentSeasonID: null, currentSeasonLabel: null, defaultDraftTags: [] },
  {},
);
const noSeasonTags = noSeasonSettings.templateTags;
test.assertEqual(noSeasonTags.current_season, "", "current_season is empty, never \"null\"");
test.assertEqual(noSeasonTags.current_season_label, "", "current_season_label is empty too");

// --- season name validation ---
test.section("season name validation");

bvr = mockBVR(teamFixturePath, mockUI(startResponse("winter-2027")));
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
team.season.startNewSeason();
const prompts = bvr.ui.getInteractionsByType("buildMenu");
test.assertEqual(prompts.length, 3, "asks again, up to three times, for a name without a leading year");
test.assertEqual(prompts[1].menuSettings.menuItems[1].data.initialText, "winter-2027", "re-asks with what was typed");
test.assertEqual(file.saves, 0, "never saves an invalid season name");
test.assert(infoMessages(bvr.ui).some((m) => m.includes("is not a season name")), "explains the expected shape");
// DraftsUI.settings() returns one shared object, so the mock does too here.
bvr = mockBVR(teamFixturePath, mockUI(startResponse("winter-2027")));
const sharedSettings = bvr.ui.settings("startNewSeason");
bvr.ui.settings = () => sharedSettings;
team = mockTeam(bvr);
team.season.store = new TeamFileStore(teamFixture());
team.season.startNewSeason();
const thirdPrompt = bvr.ui.getInteractionsByType("buildMenu")[2]?.menuSettings;
test.assertDeepEqual(
  thirdPrompt?.menuItems.map((item) => item.type),
  ["button", "textField", "datePicker"],
  "the third prompt has one button, one text field, and one date picker",
);
test.assertEqual(sharedSettings.menuSettings.menuItems.length, 1, "the shared ui.yaml settings are left untouched");

test.assertEqual(TeamFileStore.isValidSeasonID("2026-27"), true, "2026-27 is a valid name");
test.assertEqual(TeamFileStore.isValidSeasonID("2026"), false, "a bare year needs a name");
test.assertEqual(TeamFileStore.isValidSeasonID("2026-fall/x"), false, "no slashes");

// --- legacy flows ---
test.section("legacy flows");

bvr = mockBVR(missingTeamFilePath, mockUI());
team = mockTeam(bvr);
team.season.store = legacy(2026);
team.season.startNewSeason();
test.assert(infoMessages(bvr.ui).some((m) => m.includes("already has a season record draft")), "says the record draft exists");

const bareRecords = savable({ "test-team": { 2024: [{ draftID: "BARE" }], 2026: { seasonRecordData: [] } } });
test.assertEqual(legacy(2024, bareRecords).migrateBareSeason(), "migrated", "converts a bare-array season");
test.assertDeepEqual(bareRecords["test-team"][2024], { seasonRecordDraftID: "", seasonRecordData: [{ draftID: "BARE" }] }, "into the object form");
test.assertEqual(bareRecords.saves, 1, "and saves records.json");
test.assertEqual(legacy(2026, bareRecords).migrateBareSeason(), "already", "leaves an object season alone");
test.assertEqual(legacy(2025, bareRecords).migrateBareSeason(), "wrong-type", "reports a missing season");

// --- form links ---
test.section("form links");

test.assertEqual(
  GoogleForm.baseURL("https://docs.google.com/forms/d/e/ABC/viewform?usp=sf_link"),
  "https://docs.google.com/forms/d/e/ABC",
  "a pasted viewform link is cut to the base link",
);
test.assertEqual(GoogleForm.baseURL(" https://docs.google.com/forms/d/e/ABC/ "), "https://docs.google.com/forms/d/e/ABC", "spaces and a trailing slash go");
test.assertEqual(GoogleForm.baseURL("https://docs.google.com/forms/d/ABC/edit#responses"), "https://docs.google.com/forms/d/ABC", "an edit link is cut too");
test.assertEqual(GoogleForm.baseURL("not a link"), undefined, "text that is not a link gives nothing");

const urlResponse = (url) => ({ "Score Report Form": { button: "save", fieldValues: { url } } });

bvr = mockBVR(teamFixturePath, mockUI(urlResponse("https://docs.google.com/forms/d/e/NEW/viewform?usp=sf_link")));
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
test.assertEqual(team.season.ensureFormURL("varsity-score-report"), "https://docs.google.com/forms/d/e/NEW", "a missing link is asked for and cleaned");
test.assertDeepEqual(team.linksFile.terms["2026-fall"], { "varsity-score-report": "https://docs.google.com/forms/d/e/NEW" }, "and saved for the whole 2026 fall term");
test.assertEqual(team.linksFile.saves, 1, "with one save of the shared file");
test.assertEqual(file.saves, 0, "and none of the team file");
const urlPrompt = bvr.ui.getInteractionsByType("buildMenu")[0]?.menuSettings;
test.assert(urlPrompt?.menuMessage.endsWith("Varsity score report, 2026 Fall"), "the prompt names the form and season");
test.assertDeepEqual(urlPrompt?.menuItems.map((item) => item.type), ["button", "textField"], "with one text field");
test.assertEqual(team.season.ensureFormURL("varsity-score-report"), "https://docs.google.com/forms/d/e/NEW", "a saved link is used without asking");
test.assertEqual(bvr.ui.getInteractionsByType("buildMenu").length, 1, "so the prompt appears once");

bvr = mockBVR(teamFixturePath, mockUI(urlResponse("  ")));
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
test.assertEqual(team.season.ensureFormURL("varsity-score-report"), undefined, "a blank answer gives no link");
test.assertEqual(file.saves, 0, "and saves nothing");

bvr = mockBVR(teamFixturePath, mockUI(urlResponse("docs dot google")));
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
test.assertEqual(team.season.ensureFormURL("varsity-score-report"), undefined, "a non-link answer gives no link");
test.assertEqual(file.saves, 0, "and saves nothing");
test.assert(infoMessages(bvr.ui).some((m) => m.includes("not a link")), "and says so");

// Submit Game Report: one form has a link, the other is asked for.
bvr = mockBVR(teamFixturePath, mockUI(urlResponse("https://docs.google.com/forms/d/e/MS")));
team = mockTeam(bvr);
file = teamFixture();
file.seasons["2026-fall"].formURLs = { "varsity-score-report": "https://docs.google.com/forms/d/e/VARSITY" };
team.season.store = new TeamFileStore(file);
let submitted = new Game(team.dependencies, "ANY-DRAFT").resolveGoogleForms();
test.assertDeepEqual(
  submitted.map((form) => [form.name, form.url, form.postData]),
  [
    ["ms-score-report", "https://docs.google.com/forms/d/e/MS", true],
    ["varsity-score-report", "https://docs.google.com/forms/d/e/VARSITY", false],
  ],
  "Submit Game Report gets every form with this season's link",
);
test.assertEqual(team.linksFile.terms["2026-fall"]["ms-score-report"], "https://docs.google.com/forms/d/e/MS", "the asked-for link is saved for the term");
test.assertEqual(team.linksFile.terms["2026-fall"]["varsity-score-report"], "https://docs.google.com/forms/d/e/VARSITY", "the season's old link moved up to the term");
test.assertDeepEqual(file.seasons["2026-fall"].formURLs, {}, "and left the season");

bvr = mockBVR(teamFixturePath, mockUI());
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
submitted = new Game(team.dependencies, "ANY-DRAFT").resolveGoogleForms();
test.assertDeepEqual(submitted, [], "cancelled prompts skip the forms");
test.assertEqual(
  infoMessages(bvr.ui).filter((m) => m.includes("link for this season, so it was not submitted")).length,
  2,
  "each skipped form is reported",
);

// --- Start New Season form links ---
test.section("Start New Season form links");

const startAndLink = (seasonID, url) => ({ ...startResponse(seasonID), ...urlResponse(url) });

bvr = mockBVR(teamFixturePath, mockUI(startAndLink("2026-winter", "https://docs.google.com/forms/d/e/WINTER/viewform")));
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
team.season.startNewSeason();
test.assertDeepEqual(
  team.linksFile.terms["2026-winter"],
  { "varsity-score-report": "https://docs.google.com/forms/d/e/WINTER" },
  "a new season saves the link given for its term",
);
test.assertDeepEqual(file.seasons["2026-winter"]?.formURLs, {}, "not on the season");
const linkPrompt = bvr.ui.getInteractionsByType("buildMenu").find((i) => i.menuSettings.menuTitle == "Score Report Form");
test.assert(linkPrompt?.menuSettings.menuMessage.endsWith("Varsity score report, 2026 Winter"), "the link prompt names the new season");

bvr = mockBVR(teamFixturePath, mockUI(startAndLink("2026-winter", "")));
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
team.season.startNewSeason();
test.assertDeepEqual(file.seasons["2026-winter"]?.formURLs, {}, "a blank link is skipped, to be asked at Submit Game Report");
test.assertEqual(team.linksFile.terms["2026-winter"], undefined, "and nothing is shared");
test.assertEqual(file.currentSeason, "2026-winter", "and the season still starts");

bvr = mockBVR(teamFixturePath, mockUI(startAndLink("2026-winter", "https://docs.google.com/forms/d/e/W2")));
team = mockTeam(bvr);
file = teamFixtureWithWinter();
team.season.store = new TeamFileStore(file);
team.season.startNewSeason();
test.assertEqual(
  team.linksFile.terms["2026-winter"]?.["varsity-score-report"],
  "https://docs.google.com/forms/d/e/W2",
  "completing an existing season asks for its term's missing links",
);

bvr = mockBVR(teamFixturePath, mockUI(startAndLink("2026-fall", "https://docs.google.com/forms/d/e/FALL")));
team = mockTeam(bvr);
file = teamFixture();
team.season.store = new TeamFileStore(file);
team.season.startNewSeason();
test.assertEqual(team.linksFile.terms["2026-fall"]?.["varsity-score-report"], "https://docs.google.com/forms/d/e/FALL", "an existing current season gets its term's missing link");
test.assertEqual(team.linksFile.saves, 1, "saved once, in the shared file");
test.assertEqual(file.saves, 0, "with the team file untouched");

bvr = mockBVR(teamFixturePath, mockUI(startAndLink("2026-fall", "https://docs.google.com/forms/d/e/ASKED")));
team = mockTeam(bvr);
team.linksFile.terms["2026-fall"] = { "varsity-score-report": "https://docs.google.com/forms/d/e/SHARED" };
team.season.store = new TeamFileStore(teamFixture());
team.season.startNewSeason();
test.assertEqual(
  bvr.ui.getInteractionsByType("buildMenu").filter((i) => i.menuSettings.menuTitle == "Score Report Form").length,
  0,
  "a link the term already shares is not asked for",
);
test.assert(infoMessages(bvr.ui).some((m) => m.includes("already has a 2026-fall season")), "while still saying the season exists");

// --- Edit Season ---
test.section("Edit Season");

const savedLink = "https://docs.google.com/forms/d/e/SAVED";
// Answers for the Edit Season prompt. Every field is given, since the mock
// answers an unknown field with the first value it has.
const editAnswers = (overrides = {}) => ({
  "Edit Season": {
    button: "save",
    fieldValues: {
      label: "2026 Fall",
      startDate: new Date(2026, 8, 7),
      hasEndDate: false,
      endDate: new Date(2026, 8, 7),
      "form:varsity-score-report": savedLink,
      attendance: "AG, HM",
      gameReport: "AG, WK",
      newRoster: false,
      ...overrides,
    },
  },
});
const editFixture = () => teamFixture();
// Runs Edit Season with the varsity link shared for 2026 fall unless
// sharedTerms says otherwise.
function runEdit(answers, yesNo = {}, editFile = editFixture(), sharedTerms = { "2026-fall": { "varsity-score-report": savedLink } }) {
  bvr = mockBVR(teamFixturePath, mockUI(answers, yesNo));
  team = mockTeam(bvr);
  Object.assign(team.linksFile.terms, JSON.parse(JSON.stringify(sharedTerms)));
  team.season.store = new TeamFileStore(editFile);
  team.season.editCurrentSeason();
  return editFile;
}
const yesNoTitles = () => bvr.ui.getInteractionsByType("yesNo").map((i) => i.menuSettings.menuTitle);
const successMessages = () =>
  bvr.ui.getInteractionsByType("appMessage").filter((m) => m.messageType == "success").map((m) => m.message);
const editFields = () => {
  const menu = bvr.ui.getInteractionsByType("buildMenu")[0]?.menuSettings;
  return Object.fromEntries((menu?.menuItems || []).slice(1).map((item) => [item.data.name, item.data]));
};

file = runEdit(editAnswers());
let fields = editFields();
test.assertEqual(fields.label?.initialText, "2026 Fall", "prefills the name");
test.assertEqual(fields.startDate?.initialDate?.getDate(), 7, "prefills the first day from the season");
test.assertEqual(fields.startDate?.initialDate?.getMonth(), 8, "as a local date");
test.assertEqual(fields.hasEndDate?.initialValue, false, "the last-day switch is off when there is none");
test.assertEqual(fields["form:varsity-score-report"]?.initialText, savedLink, "prefills the link in effect");
test.assertEqual(fields["form:varsity-score-report"]?.label, "Varsity score report (shared for 2026 Fall)", "and marks a shared link");
test.assertEqual(file.saves + team.linksFile.saves, 0, "unchanged answers save nothing");
test.assert(infoMessages(bvr.ui).includes("Nothing changed."), "and say so");

file = runEdit(editAnswers({ label: "Fall 2026", hasEndDate: true, endDate: new Date(2026, 10, 14) }));
test.assertEqual(file.seasons["2026-fall"].label, "Fall 2026", "saves a new name");
test.assertEqual(file.seasons["2026-fall"].endDate, "2026-11-14", "saves a last day when the switch is on");
test.assertEqual(file.saves, 1, "in one save");
test.assertEqual(team.linksFile.saves, 0, "without touching the shared links");
test.assertDeepEqual(successMessages(), ["Updated Fall 2026: name, last day."], "the message lists what changed");

file = editFixture();
file.seasons["2026-fall"].endDate = "2026-11-14";
file = runEdit(editAnswers({ hasEndDate: false }), {}, file);
test.assertEqual(file.seasons["2026-fall"].endDate, null, "switching the last day off clears it");

// The fixture season has a practice plan (W1).
file = runEdit(editAnswers({ startDate: new Date(2026, 8, 14) }), { "Change the first day?": "yes" });
test.assertDeepEqual(yesNoTitles(), ["Change the first day?"], "a new first day with plans asks first");
test.assertEqual(file.seasons["2026-fall"].startDate, "2026-09-14", "and saves it on yes");
test.assertDeepEqual(file.seasons["2026-fall"].practicePlans, { W1: "PLAN-1" }, "existing plans keep their week keys");

file = runEdit(editAnswers({ startDate: new Date(2026, 8, 14), label: "Renamed" }), { "Change the first day?": "no" });
test.assertEqual(file.seasons["2026-fall"].startDate, "2026-09-07", "on no, the first day stays");
test.assertEqual(file.seasons["2026-fall"].label, "2026 Fall", "and nothing else changes either");
test.assertEqual(file.saves, 0, "and nothing is saved");

file = editFixture();
file.seasons["2026-fall"].practicePlans = {};
file = runEdit(editAnswers({ startDate: new Date(2026, 8, 14) }), {}, file);
test.assertDeepEqual(yesNoTitles(), [], "without plans, a new first day needs no warning");
test.assertEqual(file.seasons["2026-fall"].startDate, "2026-09-14", "and is saved");

file = runEdit(editAnswers({ "form:varsity-score-report": "  " }), { "Clear form links?": "yes" });
test.assertEqual(team.linksFile.terms["2026-fall"]["varsity-score-report"], undefined, "a blanked shared link is cleared on yes");
test.assertDeepEqual(successMessages(), ["Updated 2026 Fall: Varsity score report link."], "and listed as changed");

file = runEdit(editAnswers({ "form:varsity-score-report": "" }), { "Clear form links?": "no" });
test.assertEqual(team.linksFile.terms["2026-fall"]["varsity-score-report"], savedLink, "a blanked link is kept on no");
test.assertEqual(file.saves + team.linksFile.saves, 0, "with nothing saved");

file = runEdit(editAnswers({ "form:varsity-score-report": "https://docs.google.com/forms/d/e/NEWER/viewform?usp=sf_link" }));
test.assertEqual(team.linksFile.terms["2026-fall"]["varsity-score-report"], "https://docs.google.com/forms/d/e/NEWER", "a new link is cleaned and shared with the term");
test.assertEqual(file.saves, 0, "without saving the team file");
test.assertDeepEqual(successMessages(), ["Updated 2026 Fall: Varsity score report link (shared)."], "the message says it is shared");

file = runEdit(editAnswers({ "form:varsity-score-report": "not a link" }));
test.assertEqual(team.linksFile.terms["2026-fall"]["varsity-score-report"], savedLink, "a non-link leaves the saved link");
test.assert(infoMessages(bvr.ui).some((m) => m.includes("is not a link")), "and says so");

// A season's own link overrides the shared one.
file = editFixture();
file.seasons["2026-fall"].formURLs = { "varsity-score-report": "https://docs.google.com/forms/d/e/OWN" };
file = runEdit(editAnswers({ "form:varsity-score-report": "https://docs.google.com/forms/d/e/OWN2" }), {}, file);
fields = editFields();
test.assertEqual(fields["form:varsity-score-report"]?.initialText, "https://docs.google.com/forms/d/e/OWN", "an override is the link shown");
test.assertEqual(fields["form:varsity-score-report"]?.label, "Varsity score report", "without the shared mark");
test.assertEqual(file.seasons["2026-fall"].formURLs["varsity-score-report"], "https://docs.google.com/forms/d/e/OWN2", "editing it changes the override");
test.assertEqual(team.linksFile.terms["2026-fall"]["varsity-score-report"], savedLink, "and leaves the shared link");

file = editFixture();
file.seasons["2026-fall"].formURLs = { "varsity-score-report": "https://docs.google.com/forms/d/e/OWN" };
file = runEdit(editAnswers({ "form:varsity-score-report": "" }), { "Clear form links?": "yes" }, file);
test.assertDeepEqual(file.seasons["2026-fall"].formURLs, {}, "a confirmed clear removes the override");
test.assertEqual(team.linksFile.terms["2026-fall"]["varsity-score-report"], undefined, "and the shared link");

file = runEdit({});
test.assertEqual(file.saves + team.linksFile.saves, 0, "cancelling the prompt changes nothing");

// --- shared form links ---
test.section("shared form links");

bvr = mockBVR(teamFixturePath, mockUI());
team = mockTeam(bvr);
file = teamFixture();
file.seasons["2026-fall"].formURLs = { "varsity-score-report": "https://docs.google.com/forms/d/e/PASTED" };
team.season.store = new TeamFileStore(file);
test.assertEqual(team.season.ensureFormURL("varsity-score-report"), "https://docs.google.com/forms/d/e/PASTED", "a link saved on the season still works");
test.assertEqual(team.linksFile.terms["2026-fall"]?.["varsity-score-report"], "https://docs.google.com/forms/d/e/PASTED", "and moves up to the term");
test.assertDeepEqual(file.seasons["2026-fall"].formURLs, {}, "and off the season");
test.assertEqual(team.linksFile.saves, 1, "one save of the shared file");
test.assertEqual(file.saves, 1, "one save of the team file");

bvr = mockBVR(teamFixturePath, mockUI());
team = mockTeam(bvr);
team.linksFile.terms["2026-fall"] = { "varsity-score-report": "https://docs.google.com/forms/d/e/SAME" };
file = teamFixture();
file.seasons["2026-fall"].formURLs = { "varsity-score-report": "https://docs.google.com/forms/d/e/SAME" };
team.season.store = new TeamFileStore(file);
team.season.ensureFormURL("varsity-score-report");
test.assertDeepEqual(file.seasons["2026-fall"].formURLs, {}, "a season link equal to the shared one is dropped");

bvr = mockBVR(teamFixturePath, mockUI());
team = mockTeam(bvr);
team.linksFile.terms["2026-fall"] = { "varsity-score-report": "https://docs.google.com/forms/d/e/SHARED" };
file = teamFixture();
file.seasons["2026-fall"].formURLs = { "varsity-score-report": "https://docs.google.com/forms/d/e/OWN" };
team.season.store = new TeamFileStore(file);
test.assertEqual(team.season.ensureFormURL("varsity-score-report"), "https://docs.google.com/forms/d/e/OWN", "a different season link wins, as an override");
test.assertEqual(file.saves + team.linksFile.saves, 0, "and nothing moves");

bvr = mockBVR(teamFixturePath, mockUI());
team = mockTeam(bvr);
team.linksFile.terms["2026-fall"] = { "varsity-score-report": "https://docs.google.com/forms/d/e/SHARED" };
team.season.store = new TeamFileStore(teamFixture());
test.assertEqual(team.season.ensureFormURL("varsity-score-report"), "https://docs.google.com/forms/d/e/SHARED", "another team's shared link is found without asking");
test.assertEqual(bvr.ui.getInteractionsByType("buildMenu").length, 0, "so no prompt appears");

bvr = mockBVR(teamFixturePath, mockUI(urlResponse("https://docs.google.com/forms/d/e/OWNTERMLESS")));
team = mockTeam(bvr);
file = teamFixture();
file.seasons["2026-27"] = TeamFileStore.emptySeason("2026-27");
file.currentSeason = "2026-27";
team.season.store = new TeamFileStore(file);
test.assertEqual(team.season.term, undefined, "a 2026-27 season has no term");
team.season.ensureFormURL("varsity-score-report");
test.assertEqual(file.seasons["2026-27"].formURLs["varsity-score-report"], "https://docs.google.com/forms/d/e/OWNTERMLESS", "so its link is saved on the season");
test.assertDeepEqual(team.linksFile.terms, {}, "and nothing is shared");

bvr = mockBVR(missingTeamFilePath, mockUI(editAnswers()));
team = mockTeam(bvr);
team.season.store = legacy(2026);
team.season.editCurrentSeason();
test.assertEqual(bvr.ui.getInteractionsByType("buildMenu").length, 0, "an unmigrated team gets no prompt");
test.assert(infoMessages(bvr.ui).some((m) => m.includes("Run bun run bvr:migrate first")), "and is told to migrate first");

// --- Start New Season: recipients ---
test.section("Start New Season recipients");

const recipientsResponse = (attendance, gameReport) => ({
  "Who Gets Messages": { button: "save", fieldValues: { attendance, gameReport } },
});
function startWith(responses, editFile = teamFixture()) {
  bvr = mockBVR(teamFixturePath, mockUI({ ...startResponse("2026-winter"), ...responses }));
  team = mockTeam(bvr);
  team.season.store = new TeamFileStore(editFile);
  team.season.startNewSeason();
  return editFile;
}

file = startWith(recipientsResponse("AG, HM", "wk, ag"));
test.assertEqual(file.seasons["2026-winter"].recipients, null, "lists equal to the team default (in any order or case) save no override");
const recipientsMenu = bvr.ui.getInteractionsByType("buildMenu").find((i) => i.menuSettings.menuTitle == "Who Gets Messages")?.menuSettings;
test.assertDeepEqual(
  recipientsMenu?.menuItems.slice(1).map((item) => item.data.initialText),
  ["AG, HM", "AG, WK"],
  "the prompt is prefilled with the team default lists",
);

file = startWith(recipientsResponse("AG, AN", "AG, WK"));
test.assertDeepEqual(file.seasons["2026-winter"].recipients, { attendance: ["AG", "AN"] }, "only a changed list is saved for the season");

file = startWith(recipientsResponse("AG, ZZ, QQ", "AG"));
test.assertEqual(
  bvr.ui.getInteractionsByType("buildMenu").filter((i) => i.menuSettings.menuTitle == "Who Gets Messages").length,
  3,
  "unknown initials ask again, up to three times",
);
test.assert(infoMessages(bvr.ui).some((m) => m.includes("initials ZZ, QQ")), "naming the unknown initials");
test.assertEqual(file.seasons["2026-winter"].recipients, null, "and give up without an override");

file = startWith(recipientsResponse("", ""));
test.assertEqual(file.seasons["2026-winter"].recipients, null, "blank fields mean the team default");

// --- Start New Season: roster draft ---
test.section("Start New Season roster draft");

const rosterResponse = (button) => ({ "Roster Draft": { button, fieldValues: {} } });
function startWithRoster(rosterBefore, responses) {
  bvr = mockBVR(teamFixturePath, mockUI({ ...startResponse("2026-winter"), ...responses }));
  team = mockTeam(bvr);
  team.attendanceDraftID = rosterBefore;
  const rosterFile = teamFixture();
  team.season.store = new TeamFileStore(rosterFile);
  StubTemplate.rendered = [];
  team.season.startNewSeason();
  return rosterFile;
}
const rosterRenders = () => StubTemplate.rendered.filter((settings) => settings.templateFile == "bvr/attendance.md");

file = startWithRoster("OLD-ROSTER", rosterResponse("keep"));
test.assertEqual(file.seasons["2026-winter"].attendanceDraftID, "OLD-ROSTER", "keeping the roster saves its ID on the new season");
test.assertEqual(rosterRenders().length, 0, "without making a new draft");
const rosterMenu = bvr.ui.getInteractionsByType("buildMenu").find((i) => i.menuSettings.menuTitle == "Roster Draft")?.menuSettings;
test.assertEqual(rosterMenu?.menuMessage, 'Keep "Roster OLD-ROSTER" for 2026 Winter, or start a new one?', "the question names the draft and season");

file = startWithRoster("OLD-ROSTER", {});
test.assertEqual(file.seasons["2026-winter"].attendanceDraftID, "OLD-ROSTER", "cancelling the question keeps the roster");

file = startWithRoster("OLD-ROSTER", rosterResponse("new"));
test.assertEqual(file.seasons["2026-winter"].attendanceDraftID, "NEW-ROSTER-DRAFT", "a new roster draft's ID is saved on the season");
test.assertDeepEqual(rosterRenders()[0]?.draftTags, ["bvr/test"], "tagged with the team's default tag");
test.assertDeepEqual(bvr.pinned, ["NEW-ROSTER-DRAFT"], "and opened in the editor");
test.assert(successMessages().some((m) => m.includes("Update Roster")), "the message mentions Update Roster");

file = startWithRoster(undefined, {});
test.assertEqual(
  bvr.ui.getInteractionsByType("buildMenu").filter((i) => i.menuSettings.menuTitle == "Roster Draft").length,
  0,
  "a team with no roster draft is not asked",
);
test.assertEqual(file.seasons["2026-winter"].attendanceDraftID, "NEW-ROSTER-DRAFT", "and gets a new one");

// The new draft's title and date line.
bvr = mockBVR(teamFixturePath, mockUI(startResponse("2026-winter")));
team = mockTeam(bvr);
team.season.store = new TeamFileStore(teamFixture());
/** @type {any} */
let rosterDraft;
const realPin = bvr.pinDraft;
bvr.pinDraft = function (workingDraft) {
  rosterDraft = workingDraft;
  realPin.call(this, workingDraft);
};
team.season.startNewSeason();
const today = bvr.formatDateYMD(new Date());
test.assertEqual(rosterDraft?.content.split("\n")[0], "# Attendance: TT 2026 Winter", "the title names the team and season (with a year for Update Roster)");
test.assertEqual(rosterDraft?.content.split("\n")[2], `_For: ${today}_`, "the date line is today");

file = teamFixtureWithWinter();
bvr = mockBVR(teamFixturePath, mockUI({ ...startResponse("2026-winter"), ...rosterResponse("keep") }));
team = mockTeam(bvr);
team.attendanceDraftID = "OLD-ROSTER";
team.season.store = new TeamFileStore(file);
team.season.startNewSeason();
test.assertEqual(file.seasons["2026-winter"].attendanceDraftID, "OLD-ROSTER", "completing an existing season without a roster asks for one");

// --- Edit Season: recipients and roster ---
test.section("Edit Season recipients and roster");

file = runEdit(editAnswers());
fields = editFields();
test.assertEqual(fields.attendance?.label, "Attendance messages to (team default)", "a list with no season override says it is the team default");
test.assertEqual(fields.attendance?.initialText, "AG, HM", "and shows the default");
test.assertEqual(fields.roster?.label, "Roster draft: Roster ROSTER-2026-FALL", "the roster draft is shown by title");
test.assertEqual(fields.newRoster?.initialValue, false, "the new-roster switch starts off");

file = runEdit(editAnswers({ gameReport: "AG, HM, WK" }));
test.assertDeepEqual(file.seasons["2026-fall"].recipients, { gameReport: ["AG", "HM", "WK"] }, "a changed list is saved as a season override");
test.assertDeepEqual(successMessages(), ["Updated 2026 Fall: recipients."], "and listed as changed");

file = editFixture();
file.seasons["2026-fall"].recipients = { gameReport: ["AG", "HM", "WK"] };
file = runEdit(editAnswers({ gameReport: "AG, HM, WK" }), {}, file);
fields = editFields();
test.assertEqual(fields.gameReport?.label, "Score messages to", "an override is not marked as the team default");
test.assertEqual(fields.gameReport?.initialText, "AG, HM, WK", "and is shown");
test.assertEqual(file.saves, 0, "unchanged, it saves nothing");

file = editFixture();
file.seasons["2026-fall"].recipients = { gameReport: ["AG", "HM", "WK"] };
file = runEdit(editAnswers({ gameReport: "AG, WK" }), {}, file);
test.assertEqual(file.seasons["2026-fall"].recipients, null, "setting a list back to the default removes the override");

file = runEdit(editAnswers({ attendance: "AG, NOPE" }));
test.assertEqual(bvr.ui.getInteractionsByType("buildMenu").length, 3, "unknown initials ask again, up to three times");
test.assertEqual(bvr.ui.getInteractionsByType("buildMenu")[1].menuSettings.menuItems.find((i) => i.data.name == "attendance").data.initialText, "AG, NOPE", "with what was typed");
test.assertEqual(file.saves, 0, "and save nothing when they stay unknown");

file = runEdit(editAnswers({ newRoster: true }));
test.assertEqual(file.seasons["2026-fall"].attendanceDraftID, "NEW-ROSTER-DRAFT", "the switch starts a new roster draft for the season");
test.assertDeepEqual(bvr.pinned, ["NEW-ROSTER-DRAFT"], "and opens it");
test.assertDeepEqual(successMessages(), ["Updated 2026 Fall: roster draft."], "and lists it");

// --- Team.attendanceDraftID ---
test.section("Team.attendanceDraftID");

/** @type {any} */ (globalThis).draft = { hasTag: () => false };
const teamBVR = { ...mockBVR(teamFixturePath), teamSettingsFile: "../Tests/fixtures/bvr/teams.json" };
ServiceContainer.getInstance().register("bvr", () => teamBVR, true);
const realTeam = new Team("fixture-team");
realTeam.season = { currentSeasonData: { attendanceDraftID: "ROSTER-FROM-SEASON" } };
test.assertEqual(realTeam.attendanceDraftID, "ROSTER-FROM-SEASON", "the current season's roster draft comes first");
realTeam.season = { currentSeasonData: { attendanceDraftID: null } };
test.assertEqual(realTeam.attendanceDraftID, "ROSTER-FROM-TEAMS-YAML", "else the one in teams.yaml");
realTeam.season = { currentSeasonData: undefined };
test.assertEqual(realTeam.attendanceDraftID, "ROSTER-FROM-TEAMS-YAML", "also when there is no current season");

// --- shared schema fixture ---
test.section("shared schema fixture");

const cases = DataFile.load("../Tests/fixtures/bvr/schema-cases.json");
for (const [id, label] of Object.entries(cases.labels)) {
  test.assertEqual(TeamFileStore.seasonLabel(id), label, `label of ${id}`);
}
test.assertDeepEqual(Object.keys(TeamFileStore.emptySeason("2026-fall")), cases.seasonKeys, "season entry keys");
for (const { name, valid, data } of cases.teamFiles) {
  test.assertEqual(TeamFileStore.validate(data) == undefined, valid, `validate: ${name}`);
}

test.summary();
