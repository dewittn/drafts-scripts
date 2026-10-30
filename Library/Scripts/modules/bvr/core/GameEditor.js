if (typeof Game == "undefined") require("modules/bvr/core/Game.js");
if (typeof DraftsRuntime == "undefined") require("shared/libraries/DraftsRuntime.js");
if (typeof MarkdownSections == "undefined") require("shared/libraries/MarkdownSections.js");

// Edit Game, run on a game report draft from the current season: change the
// opponent, location, or score. Game.editGame() runs it.
class GameEditor {
  #game;

  constructor(game) {
    this.#game = game;
  }

  get #ui() {
    return this.#game.ui;
  }

  get #season() {
    return this.#game.team.season;
  }

  // **********************
  // Public Functions
  // **********************

  // Rewrites the report and the season record table, then saves the game. A
  // submitted game can re-send its texts and open its forms for review.
  edit() {
    const game = this.#game;
    if (!this.#season.ensureCurrentSeason()) return;

    const settings = this.#ui.settingsCopy("editGame");
    if (game.recorded == false || game.draftID == undefined) {
      return this.#ui.displayAppMessage("error", settings.notFoundMessage);
    }

    const oldRow = this.#season.recordRow(game);
    const answers = this.#askGameEdits(settings);
    if (answers == undefined) return;

    const changes = this.#describeGameEdits(answers);
    if (changes.length == 0) return this.#ui.displayAppMessage("info", "Nothing changed.");
    this.#applyGameEdits(answers);

    const reportDraft = DraftsRuntime.findDraft(game.draftID);
    if (game.submitted) game.readReportComments(reportDraft);
    const notes = this.#rewriteReportDraft(reportDraft, settings.reportSections);
    const recordOutcome = this.#season.rebuildRecordWith(game, oldRow);
    notes.push(...this.#recordNotes(recordOutcome));

    if (game.submitted) this.#correctSubmission(settings);

    this.#ui.displayAppMessage(this.#editMessageType(recordOutcome, notes), [...changes, ...notes].join(" "));
  }

  // **********************
  // Prompt
  // **********************

  // Prefilled from the team file, never from the report. A blank opponent or
  // an unpicked location keeps the current one; undefined when cancelled.
  #askGameEdits(settings) {
    const game = this.#game;
    const { menuSettings, opponentField, locationField, scorePicker } = settings;
    const columns = Game.scoreColumns(game.sport.maxScore);
    opponentField.data.initialText = game.opponent || "";
    locationField.data.selectedValues = game.location ? [game.location] : [];
    scorePicker.data.columns = columns;
    scorePicker.data.selectedRows = this.#recordedScoreRows(game.sport.maxScore);
    menuSettings.menuItems.push(opponentField, locationField, scorePicker);

    const editPrompt = this.#ui.buildMenu(menuSettings);
    if (editPrompt.show() == false) return undefined;

    const values = editPrompt.fieldValues;
    const [location] = values[locationField.data.name] || [];
    const opponent = `${values[opponentField.data.name] || ""}`.trim();
    return {
      opponent: opponent == "" ? game.opponent : opponent,
      location: location || game.location,
      score: values[scorePicker.data.name].map((row, i) => columns[i][row]),
    };
  }

  // Picker row n is the score n, held to 0..maxScore. No score yet starts at
  // the sport's usual value.
  #recordedScoreRows(maxScore) {
    const game = this.#game;
    if (game.score == undefined) return game.selectedRows;
    return game.score.map((value) => Math.min(Math.max(Number(value) || 0, 0), maxScore));
  }

  // **********************
  // Changes
  // **********************

  // One sentence per changed field, e.g. "Score 4 - 2 → 5 - 2, now a Win."
  #describeGameEdits({ opponent, location, score }) {
    const game = this.#game;
    const changes = [];
    if (opponent != game.opponent) changes.push(`Opponent ${game.opponent} → ${opponent}.`);
    if (location != game.location) changes.push(`Location ${game.location} → ${location}.`);

    const fullScore = score.join(" - ");
    if (fullScore != game.fullScore) {
      const result = Game.winLoseOrDraw(score);
      const resultText = result == game.result ? `still a ${result}` : `now a ${result}`;
      changes.push(`Score ${game.fullScore} → ${fullScore}, ${resultText}.`);
    }
    return changes;
  }

  #applyGameEdits({ opponent, location, score }) {
    const game = this.#game;
    game.opponent = opponent;
    game.location = location;
    game.score = score;
    game.result = Game.winLoseOrDraw(score);
  }

  // Copy the freshly rendered report's title and the given sections into the
  // draft; other lines stay as typed. Returns a note naming missing headings.
  #rewriteReportDraft(reportDraft, headings) {
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    const rendered = new Template(this.#game.tmplSettingsGameReport).content.split("\n");
    const { lines, missing } = MarkdownSections.transplant(reportDraft.content.split("\n"), rendered, headings);

    reportDraft.content = lines.join("\n");
    reportDraft.update();
    if (missing.length == 0) return [];
    const names = missing.map((heading) => heading.replace(/^#+\s*/, ""));
    return [`Not found in the report, so not updated: ${names.join(", ")}.`];
  }

  // **********************
  // Results
  // **********************

  // What to add to the final message about the season record draft.
  #recordNotes(outcome) {
    const notes = {
      declined: "The season record draft was not updated.",
      missing: "The season record draft could not be found, so it was not updated.",
      noTable: "The season record draft has no table, so it was not updated.",
    };
    return notes[outcome] == undefined ? [] : [notes[outcome]];
  }

  // Error when the record draft could not be rebuilt, warning for anything
  // else left undone, otherwise success.
  #editMessageType(recordOutcome, notes) {
    if (recordOutcome == "missing" || recordOutcome == "noTable") return "error";
    if (notes.length > 0) return "warning";
    return "success";
  }

  // Offer to re-send the texts, then to open each form prefilled for review.
  // Forms are never posted, and the game day tasks are not run again.
  #correctSubmission({ resendTextsPrompt, reviewFormsPrompt }) {
    const game = this.#game;
    if (game.msgSettings != undefined && this.#ui.yesNoPrompt({ ...resendTextsPrompt }) == "yes") {
      game.sendMessages();
    }
    if (game.googleFormSettings == undefined || game.googleFormSettings.length == 0) return;
    if (this.#ui.yesNoPrompt({ ...reviewFormsPrompt }) != "yes") return;

    game.resolveGoogleForms().forEach((gform) => game.submitGoogleForm({ ...gform, postData: false }));
  }
}
