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

  // True when there is a season to record into. Otherwise says to run Start
  // New Season and returns false. Callers check before any prompt appears.
  // The old files always have one: the calendar year.
  ensureCurrentSeason() {
    if (this.currentSeasonData != undefined) return true;

    this.ui.displayAppMessage(
      "error",
      `${this.teamName} has no current season. Run Start New Season first.`,
    );
    return false;
  }

  updateWith(game) {
    if (game == undefined) {
      return this.ui.displayAppMessage("error", "Game data missing!");
    }
    if (!this.ensureCurrentSeason()) return;
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

    this.#reportBareSeasonMigration(this.store.migrateBareSeason());

    if (this.seasonRecordDraftID == undefined) {
      this.#createSeasonRecordDraft();
      this.#populateSeasonRecordDraft();
    }
  }

  // A team with history in the old files but no team file keeps the old
  // behavior until it is migrated. Every other team gets a new season in its
  // team file, which is created here for a team with no history at all.
  startNewSeason() {
    if (!this.usesTeamFile && this.store.hasTeamData) return this.#startLegacySeason();
    return this.#startTeamFileSeason();
  }

  // **********************
  // Private Functions
  // **********************

  // The team file when there is one. A team file that exists but cannot be
  // read stops the action: falling back to records.json would hide its games,
  // and writing would overwrite them.
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

  // Old files: give this calendar year a season record draft, as before.
  #startLegacySeason() {
    if (this.seasonRecordDraftID != undefined) {
      return this.ui.displayAppMessage(
        "info",
        `${this.teamName} already has a season record draft for ${this.currentSeasonID}.`,
      );
    }
    this.#createSeasonRecordDraft();
  }

  // Team file: prompt for the season, add it, make it current, and give it a
  // season record draft.
  #startTeamFileSeason() {
    if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
    const details = this.#promptForNewSeason();
    if (details == undefined) return;

    if (this.usesTeamFile && this.store.hasSeason(details.seasonID)) {
      return this.ui.displayAppMessage(
        "info",
        `${this.teamName} already has a ${details.seasonID} season.`,
      );
    }
    if (!this.usesTeamFile) {
      this.store = TeamFileStore.create(this.teamFilePath, this.teamID);
    }

    // Later phases add steps here (form URL, recipients, attendance draft)
    // and pass what they collect to addSeason with the start date.
    this.store.addSeason(details.seasonID, { startDate: details.startDate });
    this.store.setCurrentSeason(details.seasonID);
    this.#createSeasonRecordDraft();
  }

  // Ask for the new season's ID and start date, asking again (up to three
  // times) when the ID is not <year>-<name>. Returns undefined if the prompt
  // is cancelled or no valid ID is given.
  #promptForNewSeason() {
    let seasonID = this.#defaultNewSeasonID();
    for (let attempt = 1; attempt <= 3; attempt++) {
      const answer = this.#showNewSeasonPrompt(seasonID);
      if (answer == undefined) return undefined;
      if (TeamFileStore.isValidSeasonID(answer.seasonID)) return answer;

      seasonID = answer.seasonID;
      this.ui.displayAppMessage(
        "info",
        `"${seasonID}" is not a season name. Start with the year, then a name: 2026-winter or 2026-27.`,
      );
    }
    return undefined;
  }

  #showNewSeasonPrompt(initialSeasonID) {
    const { menuSettings, seasonIDField, startDateField } = this.ui.settings("startNewSeason");
    seasonIDField.data.initialText = initialSeasonID;
    startDateField.data.initialDate = this.#comingMonday();
    menuSettings.menuItems.push(seasonIDField, startDateField);

    const seasonPrompt = this.ui.buildMenu(menuSettings);
    if (seasonPrompt.show() == false) return undefined;

    const seasonID = `${seasonPrompt.fieldValues[seasonIDField.data.name] || ""}`.trim();
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

  #reportBareSeasonMigration(result) {
    const messages = {
      already: ["info", "Current season has already been migrated."],
      "wrong-type": ["error", "The current season is the wrong type and will not be migrated."],
    };
    if (result == "migrated") {
      return alert(`The ${this.teamID} ${this.currentSeasonID} season has been migrated!`);
    }
    const [type, message] = messages[result];
    return this.ui.displayAppMessage(type, message);
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
