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
    this.#tmplSettings = this.templateSettings;
    this.#schoolSportingHistory = new DataFile(this.recordsFile);
  }

  get ui() {
    return this.#bvr.ui;
  }

  get templateSettings() {
    return this.#team.templateSettings;
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
    // if (typeof this.teamHistory[this.currentSeasonID] == "array")
    //   this.migrateSeasonData();

    return this.teamHistory[this.currentSeasonID];
  }

  get currentSeasonRecord() {
    const record = this.currentSeasonData?.seasonRecordData;
    return record != undefined ? record : [];
  }

  set currentSeasonRecord(arry) {
    this.currentSeasonData.record = arry;
  }

  get seasonRecordDraftID() {
    return this.teamHistory[this.currentSeasonID]?.seasonRecordDraftID;
  }

  get recordRowTmplSettings() {
    return this.#tmplSettings.recordRow;
  }

  get seasonRecordTmplSettings() {
    return this.#tmplSettings.seasonRecord;
  }

  updateWith(gameData) {
    if (gameData.recorded != true) return false;
  }

  migrateCurrentSeason() {
    this.#migrateSeasonData(this.currentSeasonID);

    if (this.seasonRecordDraftID == undefined) {
      this.#createSeasonRecordDraft(this.currentSeasonID);
      this.#populateSeasonRecordDraft(this.currentSeasonID);
    }
  }

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

    const tmplSettings = this.#generateTmplSettings(
      this.seasonRecordTmplSettings
    );
    const seasonRecordDraft = new Template(tmplSettings);
    seasonRecordDraft.archive().save();
    this.ui.debugVariable(seasonRecordDraft.draft);

    this.teamHistory[seasonID].seasonRecordDraftID = seasonRecordDraft.draftID;
    this.#schoolSportingHistory.save();

    return this.ui.displayAppMessage("success", "Season record draft created.");
  }

  //  teamHistory -> seasonData -> recordDraftID
  //  teamHistory -> seasonData -> recordData
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

  #appendToRecordsDraft(gameData) {
    if (this.seasonRecordDraftID == undefined || gameData == undefined)
      return alert("Game could not be appended.");

    if (this.recordsDraft == undefined)
      this.recordsDraft = Draft.find(this.seasonRecordDraftID);

    const tmplSettings = this.#generateTmplSettings(
      this.recordRowTmplSettings,
      gameData
    );
    const newTableLine = new Template(tmplSettings);

    this.recordsDraft.append(newTableLine.content);
    this.recordsDraft.update();
  }

  #saveRecordsData() {
    this.#gameData.descrition = this.description;
    this.currentSeasonRecord = [...this.seasonRecord, this.#gameData];
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

  #generateTmplSettings(settings = {}, gameData) {
    const templateSettings = {
      ...settings,
      templateTags: {
        ...this.globalTemplateTags,
        team_name: this.teamName,
        current_season: `${this.currentSeasonID}`,
        game_date: gameData?.formattedDate,
        game_location: gameData?.location,
        game_opponent: gameData?.opponent,
        game_result: gameData?.result,
        game_score: gameData?.fullScore,
        game_score_us: gameData?.score[0],
        game_score_them: gameData?.score[1],
        game_description: gameData?.description,
        game_summary: gameData?.summary,
        game_highlights: gameData?.highlights,
        game_comments: gameData?.comments,
      },
    };
    templateSettings.draftTags =
      templateSettings.draftTags == undefined
        ? this.defaultDraftTags
        : [...this.defaultDraftTags, ...templateSettings.draftTags];
    return templateSettings;
  }
}
