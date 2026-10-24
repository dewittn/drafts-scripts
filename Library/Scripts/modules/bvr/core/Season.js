// A team's current season: its games, season record draft, and practice
// plans. The data lives in the team file (bvr/teams/<teamID>.json) once the
// team is migrated, and in records.json + practicePlans.json until then.
// `store` picks one per run; everything else goes through it. Start New
// Season and Edit Season are SeasonSetup and SeasonEditor.
class Season {
  #bvr;
  #team;
  #tmplSettings;
  #store;
  #formLinks;
  #seasonFormLinks;
  #dependencies;

  constructor(dependencies) {
    // Store dependencies but don't instantiate if not provided
    this.#dependencies = dependencies;

    if (dependencies != undefined) {
      this.#bvr = dependencies.bvr;
      this.#team = dependencies.team;
      this.#tmplSettings = dependencies.tmplSettings;
    }
  }

  // **********************
  // Getters/Setters
  // **********************

  get bvr() {
    if (!this.#bvr && this.#dependencies == undefined) {
      if (typeof BVR == "undefined") require("modules/bvr/core/BVR.js");
      this.#bvr = new BVR();
    }
    return this.#bvr;
  }

  get team() {
    if (!this.#team && this.#dependencies == undefined) {
      if (typeof Team == "undefined") require("modules/bvr/core/Team.js");
      this.#team = new Team();
    }
    return this.#team;
  }

  // The team file if the team has one, otherwise the old files.
  get store() {
    if (!this.#store) this.#store = this.#selectStore();
    return this.#store;
  }

  set store(value) {
    this.#store = value;
  }

  // Score-form links shared by every team in a term (bvr/formLinks.json).
  // An unusable file stops the action, as an unusable team file does.
  get formLinks() {
    if (!this.#formLinks) {
      if (typeof FormLinkStore == "undefined") require("modules/bvr/storage/FormLinkStore.js");
      try {
        this.#formLinks = FormLinkStore.load(this.bvr.formLinksFile);
      } catch (error) {
        const message = `${error.message}. Nothing was changed. If iCloud is still syncing, wait and try again.`;
        this.ui.displayAppMessage("error", message);
        throw new Error(message);
      }
    }
    return this.#formLinks;
  }

  set formLinks(value) {
    this.#formLinks = value;
  }

  // The effective link, lifting, and save-to-term-or-season rules.
  get seasonFormLinks() {
    if (!this.#seasonFormLinks) {
      if (typeof SeasonFormLinks == "undefined") require("modules/bvr/utils/SeasonFormLinks.js");
      this.#seasonFormLinks = new SeasonFormLinks(this);
    }
    return this.#seasonFormLinks;
  }

  // "2026-fall" for a 2026-fall season; undefined for a season with no term
  // (2026-27, or a team on the old files).
  get term() {
    if (!this.usesTeamFile) return undefined;
    if (typeof FormLinkStore == "undefined") require("modules/bvr/storage/FormLinkStore.js");
    return FormLinkStore.termFor(this.currentSeasonID);
  }

  get usesTeamFile() {
    return this.store.isTeamFile;
  }

  get ui() {
    return this.bvr.ui;
  }

  get globalTemplateTags() {
    return this.bvr.globalTags;
  }

  get defaultDraftTags() {
    return [this.team.defaultTag];
  }

  get recordsFile() {
    return this.bvr.recordsFile;
  }

  get teamFilePath() {
    return this.bvr.teamFilePath(this.teamID);
  }

  get teamID() {
    return this.team.id;
  }

  get teamName() {
    return this.team.name;
  }

  // "2026-fall" from a team file, the calendar year from the old files.
  get currentSeasonID() {
    return this.store.seasonID;
  }

  get currentSeasonLabel() {
    return this.store.label;
  }

  get currentSeasonData() {
    return this.store.season;
  }

  get currentSeasonRecord() {
    return this.store.games;
  }

  set currentSeasonRecord(arry) {
    this.store.games = arry;
  }

  get seasonRecordDraftID() {
    return this.store.seasonRecordDraftID;
  }

  // Week 1 of the practice-plan counter. A season without its own start
  // date falls back to the team's in teams.yaml.
  get startDate() {
    const seasonStart = this.store.startDate;
    return seasonStart != undefined ? seasonStart : this.team.startDate;
  }

  get gblTmplSettings() {
    return this.team.gblTmplSettings;
  }

  get tmplSettingsSeasonRecord() {
    if (typeof TmplSettings == "undefined") require("modules/bvr/utils/TmplSettings.js");
    return new TmplSettings(
      this.gblTmplSettings,
      this.#tmplSettings?.seasonRecord,
    );
  }

  // **********************
  // Public Functions
  // **********************

  // True when there is a season to record into (the old files always have
  // one, the calendar year); otherwise says to run Start New Season.
  ensureCurrentSeason() {
    if (this.currentSeasonData != undefined) return true;

    this.ui.displayAppMessage(
      "error",
      `${this.teamName} has no current season. Run Start New Season first.`,
    );
    return false;
  }

  // The current season's link for a form: its own override, then the term's
  // shared link, then asked for. Undefined if none is given.
  ensureFormURL(formName) {
    const links = this.seasonFormLinks;
    if (this.usesTeamFile) links.liftSeasonLinks(this.currentSeasonID);

    const effective = links.effective(formName, this.store.formURLs, this.term);
    if (effective.url) return effective.url;

    const url = this.promptForFormURL(formName);
    if (url == undefined) return undefined;
    const placed = links.place(this.term, this.store.formURLs, { [formName]: url });
    if (placed.shared.length > 0) this.formLinks.save();
    if (formName in placed.season) this.store.saveFormURL(formName, url);
    return url;
  }

  updateWith(game) {
    if (game == undefined) {
      return this.ui.displayAppMessage("error", "Game data missing!");
    }
    if (!this.ensureCurrentSeason()) return;
    game.appended = this.#appendToRecordsDraft(game);
    this.#saveRecordsData(game);
  }

  // Save an edited game and rebuild the record draft from this season's games
  // (oldRow, its row before the edit, is expected to go). Returns "rebuilt",
  // "declined", "missing", or "noTable"; the game is saved regardless.
  rebuildRecordWith(game, oldRow) {
    if (game == undefined) {
      return this.ui.displayAppMessage("error", "Game data missing!");
    }
    if (!this.ensureCurrentSeason()) return undefined;
    const outcome = this.#rebuildRecordsDraft(game, oldRow);
    this.#saveRecordsData(game);
    return outcome;
  }

  // A game's season record row, rendered from game-record-row.md.
  recordRow(game) {
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    return new Template(game.tmplSettingsRecordRow).content;
  }

  startNewSeason() {
    if (typeof SeasonSetup == "undefined") require("modules/bvr/core/SeasonSetup.js");
    return new SeasonSetup(this, this.#tmplSettings).start();
  }

  editCurrentSeason() {
    if (typeof SeasonSetup == "undefined") require("modules/bvr/core/SeasonSetup.js");
    if (typeof SeasonEditor == "undefined") require("modules/bvr/core/SeasonEditor.js");
    return new SeasonEditor(this, new SeasonSetup(this, this.#tmplSettings)).edit();
  }

  // **********************
  // Forms (also used by SeasonSetup and SeasonEditor)
  // **********************

  formTitle(formName) {
    return this.team.form(formName).title || formName;
  }

  // Ask for one score form's link for a season. Blank skips it; something
  // that is not a link is reported and skipped.
  promptForFormURL(formName, seasonLabel = this.currentSeasonLabel) {
    if (typeof GoogleForm == "undefined") require("modules/bvr/services/GoogleForm.js");
    const section = this.ui.settingsCopy("formURLPrompt");
    const { menuSettings, urlField } = section;
    const title = this.formTitle(formName);
    menuSettings.menuMessage = `${menuSettings.menuMessage}\n\n${title}, ${seasonLabel}`;
    menuSettings.menuItems.push(urlField);

    const urlPrompt = this.ui.buildMenu(menuSettings);
    if (urlPrompt.show() == false) return undefined;

    const pasted = `${urlPrompt.fieldValues[urlField.data.name] || ""}`.trim();
    if (pasted == "") return undefined;

    const url = GoogleForm.baseURL(pasted);
    if (url == undefined) {
      this.ui.displayAppMessage("info", `That is not a link, so the ${title} link was not saved.`);
    }
    return url;
  }

  // **********************
  // Private Functions
  // **********************

  // A team file that exists but cannot be read stops the action: falling
  // back to records.json would hide its games, and writing would overwrite them.
  #selectStore() {
    if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
    let teamFile;
    try {
      teamFile = TeamFileStore.load(this.teamFilePath);
    } catch (error) {
      const message = `${error.message}. Nothing was changed. If iCloud is still syncing, wait and try again; otherwise restore it from ~/Backups/drafts-bvr.`;
      this.ui.displayAppMessage("error", message);
      throw new Error(message);
    }
    if (teamFile != undefined) return teamFile;

    this.ui.displayAppMessage(
      "info",
      `${this.teamName} has not been migrated to a team file yet. Using records.json.`,
    );
    return this.#legacyStore();
  }

  #legacyStore() {
    if (typeof LegacySeasonStore == "undefined") require("modules/bvr/storage/LegacySeasonStore.js");
    return new LegacySeasonStore({
      teamID: this.teamID,
      year: new Date().getFullYear(),
      startDate: this.team.startDate,
      loadRecords: () => {
        if (typeof DataFile == "undefined") require("modules/cp/filesystems/CloudFS.js");
        return new DataFile(this.recordsFile);
      },
      loadPracticePlans: () => this.bvr.ppData,
    });
  }

  #appendToRecordsDraft(game) {
    if (game.appended == true) return true;
    if (
      this.seasonRecordDraftID == undefined ||
      game.tmplSettingsRecordRow == undefined
    ) {
      this.ui.displayAppMessage("error", "Game could not be appended.");
      return false;
    }

    if (typeof SeasonRecordTable == "undefined") require("modules/bvr/utils/SeasonRecordTable.js");
    if (typeof DraftsRuntime == "undefined") require("shared/libraries/DraftsRuntime.js");
    if (this.recordsDraft == undefined) {
      this.recordsDraft = DraftsRuntime.findDraft(this.seasonRecordDraftID);
    }

    this.recordsDraft.append(this.recordRow(game));
    const tally = SeasonRecordTable.tally(this.#gamesWith(game));
    this.recordsDraft.content = SeasonRecordTable.withTally(this.recordsDraft.content.split("\n"), tally).join("\n");
    this.recordsDraft.update();
    return true;
  }

  // Rebuilt rather than patched, because the draft is never edited by hand.
  // Only the games written get appended = true.
  #rebuildRecordsDraft(game, oldRow) {
    if (typeof SeasonRecordTable == "undefined") require("modules/bvr/utils/SeasonRecordTable.js");
    const recordsDraft = this.#findRecordsDraft();
    if (recordsDraft == undefined) return "missing";

    const written = this.#recordedGames(game);
    const rows = written.map(({ game: rowGame }) => this.recordRow(rowGame));
    const rebuilt = SeasonRecordTable.rebuild(recordsDraft.content.split("\n"), rows, [oldRow]);
    if (rebuilt == undefined) return "noTable";
    if (rebuilt.vanished.length > 0 && !this.#confirmRemoveRows(rebuilt.vanished)) return "declined";

    const tally = SeasonRecordTable.tally(written.map(({ game: rowGame }) => rowGame));
    recordsDraft.content = SeasonRecordTable.withTally(rebuilt.lines, tally).join("\n");
    recordsDraft.update();
    written.forEach(({ entry, game: rowGame }) => {
      entry.appended = true;
      rowGame.appended = true;
    });
    return "rebuilt";
  }

  // Recorded games in games[] order (the row order), each with its stored
  // entry. The edited game is used as given, so its row shows the edit.
  #recordedGames(editedGame) {
    if (typeof Game == "undefined") require("modules/bvr/core/Game.js");
    return this.currentSeasonRecord
      .map((entry) => {
        const isEdited = entry.draftID != undefined && entry.draftID == editedGame.draftID;
        return { entry, game: isEdited ? editedGame : Game.fromJSON(this.#dependencies, entry) };
      })
      .filter(({ game }) => game.recorded);
  }

  // The season record draft, as the global draft when it is the open one
  // (see DraftsRuntime.findDraft). Undefined when there is none.
  #findRecordsDraft() {
    if (typeof DraftsRuntime == "undefined") require("shared/libraries/DraftsRuntime.js");
    const draftID = this.seasonRecordDraftID;
    if (draftID == undefined) return undefined;
    return DraftsRuntime.findDraft(draftID);
  }

  // Ask before a rebuild drops rows no game in the team file accounts for.
  #confirmRemoveRows(rows) {
    const { removeRowsPrompt } = this.ui.settings("editGame");
    const count = rows.length == 1 ? "1 row" : `${rows.length} rows`;
    const menuMessage = `${removeRowsPrompt.menuMessage}\n\n${count}:\n${rows.join("\n")}`;
    return this.ui.yesNoPrompt({ ...removeRowsPrompt, menuMessage }) == "yes";
  }

  #saveRecordsData(game) {
    if (game == undefined) {
      return this.ui.displayAppMessage(
        "error",
        "Season record could not be saved.",
      );
    }

    this.currentSeasonRecord = this.#gamesWith(game);
    this.store.save();
  }

  // This season's games with game in them: in place of its entry, or added
  // at the end when it is new. The stored games are not changed.
  #gamesWith(game) {
    const games = this.currentSeasonRecord;
    const index = games.findIndex((recordItem) => recordItem.draftID == game.draftID);
    if (index == -1) return [...games, game.toJSON()];
    return games.map((recordItem, i) => (i == index ? game.toJSON() : recordItem));
  }
}
