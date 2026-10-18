// A team's current season: its games, season record draft, and practice
// plans. The data lives in the team file (bvr/teams/<teamID>.json) once the
// team is migrated, and in records.json + practicePlans.json until then.
// `store` picks one per run; everything else goes through it.
class Season {
  #bvr;
  #team;
  #tmplSettings;
  #store;
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

  // Old files only: every season this team has in records.json.
  get schoolSportingHistory() {
    return this.store.records;
  }

  get teamHistory() {
    return this.store.teamHistory;
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

  updateWith(game) {
    if (game == undefined) {
      return this.ui.displayAppMessage("error", "Game data missing!");
    }
    if (this.currentSeasonData == undefined) {
      return this.ui.displayAppMessage(
        "error",
        `${this.teamName} has no current season. Run Start New Season first.`,
      );
    }
    game.appended = this.#appendToRecordsDraft(game);
    this.#saveRecordsData(game);
  }

  // Old files only: turn a bare-array season into the object form and give
  // it a record draft. bun run bvr:migrate does both for team files.
  migrateCurrentSeason() {
    if (this.usesTeamFile) {
      return this.ui.displayAppMessage(
        "info",
        `${this.teamName} already uses a team file. Nothing to migrate.`,
      );
    }

    this.#migrateSeasonData(this.currentSeasonID);

    if (this.seasonRecordDraftID == undefined) {
      this.#createSeasonRecordDraft();
      this.#populateSeasonRecordDraft();
    }
  }

  // Team files: prompt for a new season, add it, make it current, and give it
  // a season record draft. A team with no team file and no old data gets a
  // new team file here. A team with old data but no team file keeps the old
  // behavior (a record draft for this calendar year) until it is migrated.
  startNewSeason() {
    if (!this.usesTeamFile && this.store.hasTeamData) {
      if (this.seasonRecordDraftID == undefined) this.#createSeasonRecordDraft();
      return;
    }

    const details = this.#promptForNewSeason();
    if (details == undefined) return;

    if (this.usesTeamFile && this.store.hasSeason(details.seasonID)) {
      return this.ui.displayAppMessage(
        "info",
        `${this.teamName} already has a ${details.seasonID} season.`,
      );
    }
    if (!this.usesTeamFile) {
      if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
      this.store = TeamFileStore.create(this.teamFilePath, this.teamID);
    }

    // Later phases add steps here (form URL, recipients, attendance draft)
    // and pass what they collect to addSeason with the start date.
    this.store.addSeason(details.seasonID, { startDate: details.startDate });
    this.store.setCurrentSeason(details.seasonID);
    this.#createSeasonRecordDraft();
  }

  // **********************
  // Private Functions
  // **********************

  #selectStore() {
    if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
    const teamFile = TeamFileStore.load(this.teamFilePath);
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

  // Ask for the new season's ID and start date. Returns undefined if the
  // prompt is cancelled or the ID is blank.
  #promptForNewSeason() {
    const { menuSettings, seasonIDField, startDateField } = this.ui.settings("startNewSeason");
    seasonIDField.data.initialText = this.#defaultNewSeasonID();
    startDateField.data.initialDate = this.#comingMonday();
    menuSettings.menuItems.push(seasonIDField, startDateField);

    const seasonPrompt = this.ui.buildMenu(menuSettings);
    if (seasonPrompt.show() == false) return undefined;

    const seasonID = `${seasonPrompt.fieldValues[seasonIDField.data.name] || ""}`.trim();
    if (seasonID == "") {
      this.ui.displayAppMessage("info", "No season name given. Nothing was changed.");
      return undefined;
    }

    const startDate = seasonPrompt.fieldValues[startDateField.data.name];
    return { seasonID, startDate: this.bvr.formatDateYMD(startDate) };
  }

  // "<year>-<season>" from teams.yaml, e.g. 2026-fall. Any name is accepted
  // at the prompt, so a winter sport can use 2026-winter or 2026-27.
  #defaultNewSeasonID() {
    const year = new Date().getFullYear();
    const seasonName = this.team.seasonName;
    return seasonName ? `${year}-${seasonName}` : `${year}`;
  }

  // Today if it is a Monday, otherwise the next Monday.
  #comingMonday(today = new Date()) {
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysAhead = (8 - monday.getDay()) % 7;
    monday.setDate(monday.getDate() + daysAhead);
    return monday;
  }

  #migrateSeasonData(seasonID) {
    if (seasonID == undefined) return;

    if (this.teamHistory[seasonID].seasonRecordData != undefined) {
      return this.ui.displayAppMessage(
        "info",
        "Current season has already been migrated.",
      );
    }
    if (Array.isArray(this.teamHistory[seasonID]) == false) {
      return this.ui.displayAppMessage(
        "error",
        "The current season is the wrong type and will not be migrated.",
      );
    }

    this.teamHistory[seasonID] = {
      seasonRecordDraftID: "",
      seasonRecordData: this.teamHistory[seasonID],
    };

    this.store.saveGames();
    return alert(`The ${this.teamID} ${seasonID} season has been migrated!`);
  }

  #createSeasonRecordDraft() {
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    const seasonRecordDraft = new Template(this.tmplSettingsSeasonRecord);
    seasonRecordDraft.archive().save();

    this.store.seasonRecordDraftID = seasonRecordDraft.draftID;
    this.store.saveGames();

    return this.ui.displayAppMessage("success", "Season record draft created.");
  }

  #populateSeasonRecordDraft() {
    this.currentSeasonRecord.forEach((gameReport) => {
      const gameData = this.#loadGameDataFromUUID(gameReport.draftID);
      this.#appendToRecordsDraft(gameData);
    });
    return this.ui.displayAppMessage(
      "success",
      "Season record draft populated with games.",
    );
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

    if (this.recordsDraft == undefined) {
      this.recordsDraft = Draft.find(this.seasonRecordDraftID);
    }

    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    const newTableLine = new Template(game.tmplSettingsRecordRow);
    this.recordsDraft.append(newTableLine.content);
    this.recordsDraft.update();
    return true;
  }

  #saveRecordsData(game) {
    if (game == undefined) {
      return this.ui.displayAppMessage(
        "error",
        "Season record could not be saved.",
      );
    }

    const index = this.currentSeasonRecord.findIndex(
      (recordItem) => recordItem.draftID == game.draftID,
    );

    if (index !== -1) {
      this.currentSeasonRecord[index] = game.toJSON();
    } else {
      this.currentSeasonRecord = [...this.currentSeasonRecord, game.toJSON()];
    }

    this.store.saveGames();
  }

  #loadGameDataFromUUID(uuid = draft.uuid) {
    const index = this.currentSeasonRecord.findIndex(
      (game) => game.draftID == uuid,
    );
    if (index == -1) return undefined;

    const data = this.currentSeasonRecord[index];
    data.date = new Date(data.date);

    return data;
  }
}
