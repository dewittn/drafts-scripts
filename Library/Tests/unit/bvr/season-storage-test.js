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
require("modules/bvr/storage/TeamFileStore.js");
require("modules/bvr/storage/LegacySeasonStore.js");

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
    this.draftID = "NEW-RECORD-DRAFT";
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

// The startNewSeason entry from Library/Data/bvr/ui.yaml.
const uiSettings = {
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

function mockUI(promptResponses = {}) {
  /** @type {any} */
  const ui = new MockUI({ promptResponses });
  ui.settings = (name) => JSON.parse(JSON.stringify(uiSettings[name]));
  return ui;
}

const pad = (value) => `${value}`.padStart(2, "0");

function mockBVR(teamFilePath, ui = mockUI()) {
  return {
    ui,
    globalTags: {},
    recordsFile: "../Tests/fixtures/bvr/no-records.json",
    ppData: savable({}),
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
  ["label", "startDate", "endDate", "formURL", "recipients", "attendanceDraftID", "seasonRecordDraftID", "games", "practicePlans"],
  "a new entry has every schema key",
);
test.assertEqual(file.seasons["2026-winter"].label, "2026 Winter", "a new entry is labeled from its ID");
test.assertEqual(TeamFileStore.seasonLabel("2026-27"), "2026-27", "an unusual ID is its own label");

store = new TeamFileStore(savable({ schemaVersion: 1, teamID: "x", currentSeason: null, seasons: {} }));
test.assertDeepEqual(store.games, [], "no current season means no games");
test.assertEqual(store.label, null, "no current season means no label");

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
