class Season {
  #bvr;
  #team;
  #gameData;
  #tmplSettings;
  #currentSeasonID;
  #schoolSportingHistory;

  constructor(dependancies) {
    if (dependancies == undefined)
      dependancies = {
        bvr: new BVR(),
        team: new Team(),
      };

    this.#bvr = dependancies.bvr;
    this.#team = dependancies.team;
    this.#tmplSettings = dependancies.tmplSettings;
    this.#schoolSportingHistory = new DataFile(this.recordsFile);
  }

  get ui() {
    return this.#bvr.ui;
  }

  get globalTemplateTags() {
    return this.#bvr.globalTags;
  }

  get defaultDraftTags() {
    return [this.#team.defaultTag];
  }

  get recordsFile() {
    return this.#bvr.recordsFile;
  }

  get teamID() {
    return this.#team.id;
  }

  get teamName() {
    return this.#team.name;
  }

  get schoolSportingHistory() {
   return this.#schoolSportingHistory;
  }

  get teamHistory() {
    if (this.#schoolSportingHistory[this.teamID] == undefined)
      this.#schoolSportingHistory[this.teamID] = {};
    return this.#schoolSportingHistory[this.teamID];
  }

  get currentSeasonID() {
    if (this.#currentSeasonID == undefined) {
      const today = new Date();
      this.#currentSeasonID = today.getFullYear();
    }

    return this.#currentSeasonID;
  }

  get currentSeasonData() {
    if (typeof this.teamHistory[this.currentSeasonID] == "array")
      this.migrateCurrentSeason();

    if (this.teamHistory[this.currentSeasonID] == undefined) {
      this.teamHistory[this.currentSeasonID] = {};
    } 

    return this.teamHistory[this.currentSeasonID];
  }

  get currentSeasonRecord() {
    const record = this.currentSeasonData?.seasonRecordData;
    return record != undefined ? record : [];
  }

  set currentSeasonRecord(arry) {
    this.currentSeasonData.seasonRecordData = arry;
  }

  get seasonRecordDraftID() {
    return this.teamHistory[this.currentSeasonID]?.seasonRecordDraftID;
  }

  get gblTmplSettings() {
    return this.#team.gblTmplSettings;
  }

  get tmplSettingsSeasonRecord() {
    return new TmplSettings(
      this.gblTmplSettings,
      this.#tmplSettings.seasonRecord
    );
  }

  // **********************
  // Public Functions
  // **********************

  updateWith(game) {
    if (game == undefined)
      this.ui.displayAppMessage("error", "Game data missing!");
    game.appended = this.#appendToRecordsDraft(game);
    this.#saveRecordsData(game);
  }

  migrateCurrentSeason() {
    this.#migrateSeasonData(this.currentSeasonID);

    if (this.seasonRecordDraftID == undefined) {
      this.#createSeasonRecordDraft(this.currentSeasonID);
      this.#populateSeasonRecordDraft(this.currentSeasonID);
    }
  }

  startNewSeason() {
    if (this.seasonRecordDraftID == undefined) {
      this.#createSeasonRecordDraft(this.currentSeasonID);
    }
  }

  // **********************
  // Private Functions
  // **********************

  #migrateSeasonData(seasonID) {
    if (seasonID == undefined) return;

    if (this.teamHistory[seasonID].seasonRecordData != undefined)
      return this.ui.displayAppMessage(
        "info",
        "Current season has already been migrated."
      );
    if (Array.isArray(this.teamHistory[seasonID]) == false)
      return this.ui.displayAppMessage(
        "error",
        "The current season is the wrong type and will not be migrated."
      );

    this.teamHistory[seasonID] = {
      seasonRecordDraftID: "",
      seasonRecordData: this.teamHistory[seasonID],
    };

    this.#schoolSportingHistory.save();
    return alert(`The ${this.teamID} ${seasonID} season has been migrated!`);
  }

  #createSeasonRecordDraft(seasonID) {
    if (seasonID == undefined) return;

    const seasonRecordDraft = new Template(this.tmplSettingsSeasonRecord);
    seasonRecordDraft.archive().save();

    if (this.teamHistory[seasonID] == undefined)
      this.teamHistory[seasonID] = {};
    this.teamHistory[seasonID].seasonRecordDraftID = seasonRecordDraft.draftID;
    this.#schoolSportingHistory.save();

    return this.ui.displayAppMessage("success", "Season record draft created.");
  }

  #populateSeasonRecordDraft(seasonID) {
    this.currentSeasonRecord.forEach((gameReport) => {
      const gameData = this.#loadGameDataFromUUID(gameReport.draftID);
      this.#appendToRecordsDraft(gameData);
    });
    return this.ui.displayAppMessage(
      "success",
      "Season record draft populated with games."
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

    if (this.recordsDraft == undefined)
      this.recordsDraft = Draft.find(this.seasonRecordDraftID);

    const newTableLine = new Template(game.tmplSettingsRecordRow);
    this.recordsDraft.append(newTableLine.content);
    this.recordsDraft.update();
    return true;
  }

  #saveRecordsData(game) {
    if (game == undefined)
      return this.ui.displayAppMessage(
        "error",
        "Season record could not be saved."
      );

    const index = this.currentSeasonRecord.findIndex(
      (recordItem) => recordItem.draftID == game.draftID
    );

    if (index !== -1) {
      this.currentSeasonRecord[index] = game.toJSON();
    } else {
      this.currentSeasonRecord = [...this.currentSeasonRecord, game.toJSON()];
    }

    this.#schoolSportingHistory.save();
  }

  #loadGameDataFromUUID(uuid = draft.uuid) {
    const index = this.currentSeasonRecord.findIndex(
      (game) => game.draftID == uuid
    );
    if (index == -1) return undefined;

    const data = this.currentSeasonRecord[index];
    data.date = new Date(data.date);

    return data;
  }
}
