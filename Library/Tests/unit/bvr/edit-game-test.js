/**
 * Edit Game Unit Tests
 *
 * Covers the pure text helpers behind Edit Game (MarkdownSections for the
 * game report, SeasonRecordTable for the season record draft) and the Edit
 * Game flow on a mocked team: prompt, report rewrite, table rebuild, save,
 * and the extra steps for a game already submitted. All data is synthetic.
 * The real game-report.md, game-record-row.md, and game-season-record.md
 * templates are rendered by a stand-in for Template.
 *
 * Not covered here (needs Drafts): the prompt itself and writing real drafts.
 */

require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/mocks.js");
require("modules/cp/filesystems/CloudFS.js");
require("modules/bvr/utils/MarkdownSections.js");
require("modules/bvr/utils/SeasonRecordTable.js");
require("modules/bvr/utils/TmplSettings.js");
require("modules/bvr/services/GoogleForm.js");
require("modules/bvr/core/Season.js");
require("modules/bvr/core/Game.js");
require("modules/bvr/storage/TeamFileStore.js");
require("modules/bvr/storage/FormLinkStore.js");

const test = new TestAssertions("Edit Game");

// --- MarkdownSections ---
test.section("MarkdownSections");

const report = [
  "# Game Report: TT vs Old Rivals (10/1/2026)",
  "",
  "## Team",
  "",
  "Test Team",
  "",
  "## Opponent",
  "",
  "Old Rivals",
  "",
  "## Result",
  "",
  "Win",
  "",
  "## Score",
  "",
  "4 - 2",
  "",
  "## Highlights?",
  "_Check for grammar._",
  "Great defense.  ",
  "",
  "## Other/Comments",
  "Bus was late.",
];
const freshReport = [
  "# Game Report: TT vs New Rivals (10/1/2026)",
  "",
  "## Team",
  "",
  "Test Team",
  "",
  "## Opponent",
  "",
  "New Rivals",
  "",
  "## Result",
  "",
  "Loss",
  "",
  "## Score",
  "",
  "1 - 2",
  "",
  "## Highlights?",
  "_Check for grammar._",
  "",
  "## Other/Comments",
  "",
];
const sections = ["## Opponent", "## Result", "## Score"];

test.assertDeepEqual(MarkdownSections.body(report, "## Score"), ["", "4 - 2", ""], "a body runs to the next ## heading");
test.assertDeepEqual(MarkdownSections.body(report, "## Other/Comments"), ["Bus was late."], "the last body runs to the end");
test.assertEqual(MarkdownSections.body(report, "## Missing"), undefined, "a missing heading has no body");
test.assertDeepEqual(
  MarkdownSections.replaceBody(["## A", "old", "## B", "keep"], "## A", ["new", "lines"]),
  ["## A", "new", "lines", "## B", "keep"],
  "replaceBody swaps only that section's body",
);
test.assertDeepEqual(MarkdownSections.replaceTitle(["intro", "# Old", "x"], "# New"), ["intro", "# New", "x"], "replaceTitle swaps the first # line");

let transplanted = MarkdownSections.transplant(report, freshReport, sections);
test.assertEqual(transplanted.lines[0], "# Game Report: TT vs New Rivals (10/1/2026)", "the title comes from the rendered report");
test.assertDeepEqual(MarkdownSections.body(transplanted.lines, "## Opponent"), ["", "New Rivals", ""], "Opponent is replaced");
test.assertDeepEqual(MarkdownSections.body(transplanted.lines, "## Result"), ["", "Loss", ""], "Result is replaced");
test.assertDeepEqual(MarkdownSections.body(transplanted.lines, "## Score"), ["", "1 - 2", ""], "Score is replaced");
test.assertDeepEqual(transplanted.lines.slice(18), report.slice(18), "Highlights and Other/Comments are untouched, trailing spaces and all");
test.assertDeepEqual(transplanted.lines.slice(1, 6), report.slice(1, 6), "Team is untouched");
test.assertDeepEqual(transplanted.missing, [], "nothing is missing");
test.assertEqual(report[8], "Old Rivals", "the lines passed in are not changed");

const noScore = report.filter((line, i) => i < 14 || i > 17);
transplanted = MarkdownSections.transplant(noScore, freshReport, sections);
test.assertDeepEqual(transplanted.missing, ["## Score"], "a heading missing from the draft is reported");
test.assertDeepEqual(transplanted.lines.slice(14), noScore.slice(14), "and everything after it is left alone");
test.assertDeepEqual(MarkdownSections.body(transplanted.lines, "## Result"), ["", "Loss", ""], "the other sections are still replaced");

transplanted = MarkdownSections.transplant(report.slice(1), freshReport, sections);
test.assertDeepEqual(transplanted.missing, ["title"], "a draft with no title line reports it");

// --- SeasonRecordTable ---
test.section("SeasonRecordTable");

const recordHead = [
  "# Season Record: TT 2026 Fall ",
  "[[BVR Coaching]]",
  "",
  "| Date | Team | Location | Result | Us | Them |",
  "|:--|:--|:--|:--|:--|:--|",
];
const rowA = "| 10/1/2026 | Old Rivals | Home | Win | 4 | 2 |";
const rowB = "| 10/8/2026 | Synthetic B | Away | Loss | 0 | 3 |";
const rowAEdited = "| 10/1/2026 | Old Rivals | Home | Loss | 1 | 2 |";
const rowC = "| 10/15/2026 | Synthetic C | Home | Draw | 2 | 2 |";

test.assertEqual(SeasonRecordTable.separatorIndex(recordHead), 4, "finds the separator row");
test.assertEqual(SeasonRecordTable.separatorIndex(["| A |", "| - |"]), 1, "a separator without colons counts");
test.assertEqual(SeasonRecordTable.separatorIndex(["# No table"]), -1, "a draft without a table has none");

let rebuilt = SeasonRecordTable.rebuild([...recordHead, rowA, rowB], [rowA, rowB]);
test.assertDeepEqual(rebuilt?.lines, [...recordHead, rowA, rowB], "an unchanged season reproduces the table exactly");
test.assertDeepEqual(rebuilt?.vanished, [], "with nothing vanishing");

rebuilt = SeasonRecordTable.rebuild([...recordHead, rowA, rowB], [rowAEdited, rowB], [rowA]);
test.assertDeepEqual(rebuilt?.lines, [...recordHead, rowAEdited, rowB], "the edited row is replaced in place");
test.assertDeepEqual(rebuilt?.vanished, [], "and its old row is expected to go");

rebuilt = SeasonRecordTable.rebuild([...recordHead, rowA], [rowA, rowB]);
test.assertDeepEqual(rebuilt?.lines, [...recordHead, rowA, rowB], "a game never appended is added");

rebuilt = SeasonRecordTable.rebuild([...recordHead, rowA, rowC, rowB], [rowAEdited, rowB], [rowA]);
test.assertDeepEqual(rebuilt?.vanished, [rowC], "a row no game accounts for is reported as vanishing");

rebuilt = SeasonRecordTable.rebuild([...recordHead, rowB, rowB], [rowB]);
test.assertDeepEqual(rebuilt?.vanished, [rowB], "a duplicate row counts once per match");

rebuilt = SeasonRecordTable.rebuild([...recordHead, rowA, ""], [rowA]);
test.assertDeepEqual(rebuilt?.lines, [...recordHead, rowA, ""], "a trailing newline is kept");

const before = [...recordHead];
rebuilt = SeasonRecordTable.rebuild(before, [rowA]);
test.assertDeepEqual(rebuilt?.lines.slice(0, 5), recordHead, "everything above the separator is kept");
test.assertDeepEqual(before, recordHead, "the lines passed in are not changed");
test.assertEqual(SeasonRecordTable.rebuild(["# Season Record"], [rowA]), undefined, "no table gives undefined");

const results = (...list) => list.map((result) => ({ result, recorded: true }));
test.assertEqual(SeasonRecordTable.tally([]), "0-0-0", "no games is 0-0-0");
test.assertEqual(SeasonRecordTable.tally(results("Win", "Loss", "Win", "Draw")), "2-1-1", "counts wins, losses, and draws");
test.assertEqual(SeasonRecordTable.tally([...results("Win"), { result: "Loss", recorded: false }]), "1-0-0", "a game not recorded is not counted");

const titled = (title) => SeasonRecordTable.withTally([title, "[[BVR Coaching]]"], "4-2-2");
test.assertEqual(titled("# Season Record: TT 2026 Fall (0-0-0)")[0], "# Season Record: TT 2026 Fall (4-2-2)", "the record in the title is replaced");
test.assertEqual(titled("# Season Record: TT 2026 Fall ")[0], "# Season Record: TT 2026 Fall (4-2-2)", "a title without one gets it");
test.assertEqual(titled("# Season Record: TT 2026 Fall (1-0-0) ")[0], "# Season Record: TT 2026 Fall (4-2-2)", "trailing spaces are dropped");
test.assertEqual(titled("# Season Record: TT 2026 (Fall)")[0], "# Season Record: TT 2026 (Fall) (4-2-2)", "other parentheses are kept");
test.assertEqual(titled("# Season Record: TT")[1], "[[BVR Coaching]]", "only the title changes");
test.assertDeepEqual(SeasonRecordTable.withTally(["No title", rowA], "1-0-0"), ["No title", rowA], "a draft with no title is unchanged");

// --- Edit Game flow ---
test.section("Edit Game flow");

// Stand-in for Template: renders the real template file's [[tags]].
class RenderingTemplate {
  constructor(settings) {
    const text = new CloudFS("/Library/Templates").read(settings.templateFile);
    const tags = settings.templateTags || {};
    const content = text.replace(/\[\[(\w+)\]\]/g, (match, tag) => (tags[tag] == undefined ? "" : `${tags[tag]}`));
    this.draft = { uuid: "UNSAVED", content };
    this.draftID = "UNSAVED";
  }

  get content() {
    return this.draft.content;
  }
}
/** @type {any} */ (globalThis).Template = RenderingTemplate;
/** @type {any} */ (globalThis).adjustDate = (date) => date;

// A draft as Drafts has it: content, lines, and update() counted.
function fakeDraft(uuid, content) {
  return {
    uuid,
    content,
    updates: 0,
    get lines() {
      return this.content.split("\n");
    },
    append(text) {
      this.content = `${this.content}\n${text}`;
    },
    update() {
      this.updates++;
    },
  };
}

const editSettings = {
  notFoundMessage: "Run Edit Game on a game report from the current season.",
  reportSections: ["## Opponent", "## Result", "## Score"],
  opponentField: { type: "textField", data: { name: "opponent", label: "Opponent" } },
  locationField: { type: "select", data: { name: "location", label: "Location", values: ["Home", "Away"] } },
  scorePicker: { type: "picker", data: { name: "score", label: "Score" } },
  menuSettings: { menuTitle: "Edit Game", menuMessage: "Change it.", menuItems: [{ type: "button", data: { name: "Save", value: "save" } }] },
  removeRowsPrompt: { menuTitle: "Rebuild the season record?", menuMessage: "Rows would be removed." },
  resendTextsPrompt: { menuTitle: "Re-send the score texts?", menuMessage: "Send again?" },
  reviewFormsPrompt: { menuTitle: "Open the score forms?", menuMessage: "Open them?" },
};
const uiSettings = {
  editGame: editSettings,
  submitGoogleForm: { menuSettings: { menuTitle: "Google Form Submitted", menuMessage: "Submitted?", menuItems: [] } },
};

const gameEntry = (draftID, opponent, location, score, result, formattedDate, extra = {}) => ({
  draftID, opponent, location, score, result, formattedDate,
  date: "2026-10-01T16:00:00.000Z", recorded: true, appended: true, submitted: false, ...extra,
});

function savable(data) {
  const file = JSON.parse(JSON.stringify(data));
  Object.defineProperty(file, "saves", { value: 0, writable: true, enumerable: false });
  Object.defineProperty(file, "save", { value() { this.saves++; }, enumerable: false });
  return file;
}

// A team, season, and open report draft wired the way Team wires them.
// edits: the Edit Game prompt's answers; yesNo: answers by prompt title.
function setUp({ games, edits, yesNo = {}, openDraftID = "GAME-1", recordDraftID = "REC" }) {
  const ui = /** @type {any} */ (new MockUI({ promptResponses: edits == undefined ? {} : { "Edit Game": { button: "save", fieldValues: edits } } }));
  ui.settings = (name) => JSON.parse(JSON.stringify(uiSettings[name]));
  ui.yesNoPrompt = (menuSettings) => {
    ui.interactions.push({ type: "yesNo", menuSettings });
    return yesNo[menuSettings.menuTitle] || "no";
  };

  const bvr = { ui, globalTags: { hc_name: "Coach Test" }, formatDateMDY: () => "10/2/2026", formatDateYMD: () => "2026-10-01" };
  const file = savable({
    schemaVersion: 1,
    teamID: "test-team",
    currentSeason: "2026-fall",
    seasons: {
      "2026-fall": {
        label: "2026 Fall",
        seasonRecordDraftID: recordDraftID,
        formURLs: { "ms-score-report": "https://docs.google.com/forms/d/e/MS" },
        games,
      },
    },
  });

  const team = /** @type {any} */ ({ id: "test-team", name: "Test Team", abbr: "TT", defaultTag: "bvr/test", season: null });
  team.form = (name) => ({ name, title: "MS score report" });
  team.gameReportSettings = {
    messageSettings: [{ to: "AG" }],
    googleFormSettings: [{ name: "ms-score-report", title: "MS score report", postData: true, fields: [{ key: "fullScore", entryID: 1 }] }],
  };
  Object.defineProperty(team, "gblTmplSettings", {
    get: () => ({
      teamName: team.name,
      teamAbbr: team.abbr,
      defaultDraftTags: [team.defaultTag],
      globalTemplateTags: bvr.globalTags,
      teamTemplateTags: {},
      currentSeasonID: team.season.currentSeasonID,
      currentSeasonLabel: team.season.currentSeasonLabel,
    }),
  });
  team.dependencies = {
    bvr,
    team,
    tmplSettings: {
      gameReport: { templateFile: "bvr/game-report.md" },
      recordRow: { templateFile: "bvr/game-record-row.md" },
      seasonRecord: { templateFile: "bvr/game-season-record.md" },
    },
  };
  team.season = new Season(team.dependencies);
  team.season.store = new TeamFileStore(file);
  team.season.formLinks = new FormLinkStore(savable({ schemaVersion: 1, terms: {} }));

  // The report and record drafts as Record Game Score left them.
  const renderGame = (entry) => Game.fromJSON(team.dependencies, entry);
  const openEntry = games.find((entry) => entry.draftID == openDraftID);
  const reportText = openEntry == undefined
    ? "# Some other draft"
    : new RenderingTemplate(renderGame(openEntry).tmplSettingsGameReport).content
      .replace("_Check for grammar and spelling. Please include some statistical info if possible._\n", "$&Great defense.  \n")
      .replace("_(Any notes about refs, buses, etc)_\n", "$&Bus was late.\n");
  const reportDraft = fakeDraft(openDraftID, reportText);
  const head = new RenderingTemplate(team.season.tmplSettingsSeasonRecord).content;
  const rows = games.filter((entry) => entry.appended).map((entry) => team.season.recordRow(renderGame(entry)));
  const recordDraft = fakeDraft("REC", [head, ...rows].join("\n"));

  /** @type {any} */ (globalThis).draft = reportDraft;
  /** @type {any} */ (globalThis).Draft = { find: (uuid) => (uuid == "REC" ? recordDraft : undefined) };
  const sent = [];
  const opened = [];
  /** @type {any} */ (globalThis).meesageFactory = (config) => ({ messageText: "score", compose() {}, send() { sent.push(config); } });
  /** @type {any} */ (globalThis).app = { openURL: (url) => opened.push(url) };

  const game = new Game(team.dependencies, openDraftID);
  game.sport = { maxScore: 10, selectedValue: 6 };
  return { ui, file, team, game, reportDraft, recordDraft, reportText, head, renderGame, sent, opened };
}

const lastMessage = (ui) => ui.getInteractionsByType("appMessage").slice(-1)[0];
const seasonGames = (file) => file.seasons["2026-fall"].games;

const twoGames = () => [
  gameEntry("GAME-1", "Old Rivals", "Home", ["4", "2"], "Win", "10/1/2026"),
  gameEntry("GAME-2", "Synthetic B", "Away", ["0", "3"], "Loss", "10/8/2026"),
];

// Score change only.
let run = setUp({ games: twoGames(), edits: { opponent: "Old Rivals", location: ["Home"], score: [1, 2] } });
run.game.editGame();
let prompt = run.ui.getInteractionsByType("buildMenu")[0]?.menuSettings;
test.assertDeepEqual(prompt?.menuItems.map((item) => item.type), ["button", "textField", "select", "picker"], "one prompt with opponent, location, and score");
test.assertEqual(prompt?.menuItems[1].data.initialText, "Old Rivals", "the opponent is prefilled from the team file");
test.assertDeepEqual(prompt?.menuItems[2].data.selectedValues, ["Home"], "the location is preset");
test.assertDeepEqual(prompt?.menuItems[3].data.selectedRows, [4, 2], "the score picker is preset to the recorded score");
test.assertEqual(prompt?.menuItems[3].data.columns[0].length, 11, "picker rows run 0 to the sport's maxScore");
test.assertDeepEqual(seasonGames(run.file)[0].score, ["1", "2"], "the new score is saved as the picker's values");
test.assertEqual(seasonGames(run.file)[0].result, "Loss", "the result is recomputed");
test.assertEqual(run.file.saves, 1, "the team file is saved once");

const editedEntry = { ...twoGames()[0], score: ["1", "2"], result: "Loss" };
const expectedReport = new RenderingTemplate(run.renderGame(editedEntry).tmplSettingsGameReport).content
  .replace("_Check for grammar and spelling. Please include some statistical info if possible._\n", "$&Great defense.  \n")
  .replace("_(Any notes about refs, buses, etc)_\n", "$&Bus was late.\n");
test.assertEqual(run.reportDraft.content, expectedReport, "the report's Result and Score change; highlights and comments are kept as typed");
test.assertEqual(run.reportDraft.updates, 1, "the report draft is saved");
const recordLines = run.recordDraft.content.split("\n");
test.assertEqual(recordLines[5], "| 10/1/2026 | Old Rivals | Home | Loss | 1 | 2 |", "the record table shows the new score");
test.assertEqual(recordLines[6], "| 10/8/2026 | Synthetic B | Away | Loss | 0 | 3 |", "and keeps the other game");
test.assertEqual(recordLines.length, 7, "with no extra rows");
test.assertEqual(run.head.split("\n")[0], "# Season Record: TT 2026 Fall (0-0-0)", "a new season record draft starts at 0-0-0");
test.assertEqual(recordLines[0], "# Season Record: TT 2026 Fall (0-2-0)", "the title's record is recounted");
test.assertEqual(lastMessage(run.ui)?.messageType, "success", "ends with a success message");
test.assertEqual(lastMessage(run.ui)?.message, "Score 4 - 2 → 1 - 2, now a Loss.", "naming what changed");
test.assertEqual(run.ui.getInteractionsByType("yesNo").length, 0, "an unsubmitted game asks nothing more");

// Opponent and location: the title changes too.
run = setUp({ games: twoGames(), edits: { opponent: "  New Rivals ", location: ["Away"], score: [4, 2] } });
run.game.editGame();
test.assertEqual(run.reportDraft.lines[0], "# Game Report: TT vs New Rivals (10/1/2026)", "the title names the new opponent");
test.assertEqual(seasonGames(run.file)[0].location, "Away", "the location is saved");
test.assertEqual(run.recordDraft.lines[5], "| 10/1/2026 | New Rivals | Away | Win | 4 | 2 |", "the row shows both");
test.assertEqual(lastMessage(run.ui)?.message, "Opponent Old Rivals → New Rivals. Location Home → Away.", "both changes are named");

// Nothing changed.
run = setUp({ games: twoGames(), edits: { opponent: "Old Rivals", location: ["Home"], score: [4, 2] } });
const untouchedReport = run.reportDraft.content;
run.game.editGame();
test.assertEqual(lastMessage(run.ui)?.message, "Nothing changed.", "no change says so");
test.assertEqual(run.file.saves, 0, "and saves nothing");
test.assertEqual(run.reportDraft.content, untouchedReport, "or the report");

// Cancelled.
run = setUp({ games: twoGames(), edits: undefined });
run.game.editGame();
test.assertEqual(run.file.saves + run.reportDraft.updates + run.recordDraft.updates, 0, "cancelling changes nothing");

// Not a game report.
run = setUp({ games: twoGames(), edits: { score: [1, 2] }, openDraftID: "NOT-A-GAME" });
run.game.editGame();
test.assertEqual(lastMessage(run.ui)?.message, "Run Edit Game on a game report from the current season.", "another draft gets the error");
test.assertEqual(run.ui.getInteractionsByType("buildMenu").length, 0, "before any prompt");

// A score past maxScore is held to it.
run = setUp({ games: [gameEntry("GAME-1", "Old Rivals", "Home", ["14", "2"], "Win", "10/1/2026")], edits: { opponent: "Old Rivals", location: ["Home"], score: [3, 2] } });
run.game.editGame();
test.assertDeepEqual(run.ui.getInteractionsByType("buildMenu")[0]?.menuSettings.menuItems[3].data.selectedRows, [10, 2], "the picker is clamped to maxScore");

// A game recorded but never appended gets its row, and the flag.
let games = [...twoGames(), gameEntry("GAME-3", "Synthetic C", "Home", ["2", "2"], "Draw", "10/15/2026", { appended: false })];
run = setUp({ games, edits: { opponent: "Old Rivals", location: ["Home"], score: [1, 2] } });
run.game.editGame();
test.assertEqual(run.recordDraft.lines[7], "| 10/15/2026 | Synthetic C | Home | Draw | 2 | 2 |", "an unappended game is added to the table");
test.assertEqual(seasonGames(run.file)[2].appended, true, "and marked appended");

// A row no game accounts for: ask, and on no leave the draft alone.
const strayRow = "| 9/30/2026 | Scrimmage | Home | Win | 9 | 0 |";
const recordWithStray = (head) => [head, "| 10/1/2026 | Old Rivals | Home | Win | 4 | 2 |", strayRow, "| 10/8/2026 | Synthetic B | Away | Loss | 0 | 3 |"];
run = setUp({ games: twoGames(), edits: { opponent: "Old Rivals", location: ["Home"], score: [1, 2] } });
run.recordDraft.content = recordWithStray(run.head).join("\n");
const strayContent = run.recordDraft.content;
run.game.editGame();
const removePrompt = run.ui.getInteractionsByType("yesNo")[0]?.menuSettings;
test.assertEqual(removePrompt?.menuTitle, "Rebuild the season record?", "a vanishing row is asked about");
test.assert(removePrompt?.menuMessage.includes(`1 row:\n${strayRow}`), "naming how many and which");
test.assertEqual(run.recordDraft.content, strayContent, "on no the record draft is untouched");
test.assertEqual(seasonGames(run.file)[0].result, "Loss", "but the game is still saved");
test.assertEqual(lastMessage(run.ui)?.messageType, "warning", "and the message is a warning");
test.assert(lastMessage(run.ui)?.message.includes("The season record draft was not updated."), "saying the record draft was not updated");

run = setUp({ games: twoGames(), edits: { opponent: "Old Rivals", location: ["Home"], score: [1, 2] }, yesNo: { "Rebuild the season record?": "yes" } });
run.recordDraft.content = recordWithStray(run.head).join("\n");
run.game.editGame();
test.assert(!run.recordDraft.content.includes(strayRow), "on yes the table is rebuilt without the stray row");

// No record draft.
run = setUp({ games: twoGames(), edits: { opponent: "Old Rivals", location: ["Home"], score: [1, 2] }, recordDraftID: "GONE" });
run.game.editGame();
test.assertEqual(lastMessage(run.ui)?.messageType, "error", "a missing record draft is an error");
test.assertEqual(seasonGames(run.file)[0].result, "Loss", "and the game is still saved");

// Already submitted: refresh highlights, offer texts and review-only forms.
games = [gameEntry("GAME-1", "Old Rivals", "Home", ["4", "2"], "Win", "10/1/2026", { submitted: true }), twoGames()[1]];
run = setUp({
  games,
  edits: { opponent: "Old Rivals", location: ["Home"], score: [5, 2] },
  yesNo: { "Re-send the score texts?": "yes", "Open the score forms?": "yes" },
});
run.game.editGame();
test.assertEqual(seasonGames(run.file)[0].highlights.includes("Great defense."), true, "highlights are read from the report");
test.assertEqual(seasonGames(run.file)[0].comments.includes("Bus was late."), true, "and comments");
test.assertEqual(run.sent.length, 1, "the score texts are re-sent on yes");
test.assertEqual(run.opened.length, 1, "each score form is opened");
test.assert(run.opened[0].startsWith("https://docs.google.com/forms/d/e/MS/viewform?usp=pp_url"), "for review, never posted, even for a postData form");
test.assert(run.opened[0].includes(encodeURIComponent("5 - 2")), "filled in with the new score");
test.assertEqual(seasonGames(run.file)[0].submitted, true, "the game stays submitted");
test.assertEqual(lastMessage(run.ui)?.message, "Score 4 - 2 → 5 - 2, still a Win.", "ends naming the change");

run = setUp({ games, edits: { opponent: "Old Rivals", location: ["Home"], score: [5, 2] } });
run.game.editGame();
test.assertEqual(run.sent.length + run.opened.length, 0, "on no, nothing is sent or opened");

// --- Record Game Score ---
test.section("Record Game Score");

// A new game appended to the record draft recounts the title.
run = setUp({ games: twoGames(), edits: undefined });
const newGame = run.renderGame(gameEntry("GAME-3", "Synthetic C", "Home", ["2", "2"], "Draw", "10/15/2026", { appended: false }));
run.team.season.updateWith(newGame);
test.assertEqual(run.recordDraft.lines[0], "# Season Record: TT 2026 Fall (1-1-1)", "the title counts the new game");
test.assertEqual(run.recordDraft.lines.slice(-1)[0], "| 10/15/2026 | Synthetic C | Home | Draw | 2 | 2 |", "and its row is appended");
test.assertEqual(run.recordDraft.updates, 1, "in one save");
test.assertEqual(seasonGames(run.file).length, 3, "the game is saved");

test.summary();
