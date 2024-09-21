class Game {
  #bvr;
  #team;
  #gameData = {};
  #records;
  #settings;
  #tmplSettings;

  constructor(dependancies) {
    if (dependancies == undefined)
      dependancies = {
        bvr: new BVR(),
        team: new Team(),
      };

    this.#bvr = dependancies.bvr;
    this.#team = dependancies.team;

    this.sport = new Sport(this.teamPlays);
    this.#settings = this.gameReportSettings;
    this.#records = new DataFile(this.recordsFile);
    this.#tmplSettings = this.templateSettings;
  }

  get recordsFile() {
    return this.#bvr.recordsFile;
  }

  get gameReportSettings() {
    return this.#team.gameReportSettings;
  }

  get teamID() {
    return this.#team.id;
  }

  get teamName() {
    return this.#team.name;
  }

  get teamPlays() {
    return this.#team.plays;
  }

  get templateSettings() {
    return this.#team.templateSettings;
  }

  get teamRecord() {
    if (this.#records[this.teamID] == undefined)
      this.#records[this.teamID] = {};
    return this.#records[this.teamID];
  }

  set teamRecord(seasonRecord) {
    this.#records[this.teamID] = seasonRecord;
  }

  get seasonRecord() {
    const record = this.teamRecord[this.yearPlayed];
    return record != undefined ? record : [];
  }

  set seasonRecord(arry) {
    const seasonRecord = {};
    seasonRecord[this.yearPlayed] = arry;

    this.teamRecord = seasonRecord;
  }

  get selectedRows() {
    return [this.sport.selectedValue, this.sport.selectedValue];
  }

  get score() {
    return this.#gameData.score;
  }

  get scoreUs() {
    if (this.#gameData.score == undefined) return "";
    return this.#gameData.score[0];
  }

  get scoreThem() {
    if (this.#gameData.score == undefined) return "";
    return this.#gameData.score[1];
  }

  get fullScore() {
    return this.#gameData.score?.join(" - ");
  }

  get recorded() {
    if (this.#gameData.recorded == undefined) return false;

    return this.#gameData.recorded;
  }

  get result() {
    return this.#gameData.result;
  }

  get opponent() {
    return this.#gameData.opponent;
  }

  get sumbitted() {
    return this.#gameData.sumbitted;
  }

  set sumbitted(value) {
    this.#gameData.sumbitted = value;
  }

  get date() {
    if (this.#gameData?.date == undefined) return new Date();
    return this.#gameData.date;
  }

  get formattedDate() {
    if (this.#gameData.formattedDate == undefined) return "";

    return this.#gameData.formattedDate;
  }

  get googleFormDate() {
    const gameDate = new Date(this.date);
    return this.#bvr.formatDateYMD(gameDate);
  }

  get yearPlayed() {
    if (this.date == undefined) return "";

    return this.date.getFullYear();
  }

  get location() {
    return this.#gameData.location;
  }

  get locationGrammar() {
    if (this.location == "Home") return `at ${this.location.toLowerCase()}`;

    return this.location?.toLowerCase();
  }

  get summary() {
    if (this.recorded == false) return "No game recorded.";

    return `${this.teamName} recorded a ${this.result?.toLowerCase()} ${
      this.locationGrammar
    } against ${this.opponent}, with a score of ${this.fullScore} on ${
      this.formattedDate
    }.`;
  }

  get description() {
    return `${this.location} vs ${this.opponent} (${this.formattedDate})`;
  }

  get calOpponent() {
    const calOpponent = this.#gameData.calOpponent;
    if (calOpponent == "") return undefined;

    return calOpponent;
  }

  get calLocation() {
    const calLocation = this.#gameData.calLocation;
    if (calLocation == "") return undefined;

    return calLocation;
  }

  get reportTmplSettings() {
    return this.#tmplSettings.reportTemplate;
  }

  get recordTmplSettings() {
    return this.#tmplSettings.recordTemplate;
  }

  get thingsProjectTemplate() {
    return this.#tmplSettings.thingsProjectTemplate;
  }

  get defaultDraftTags() {
    return [this.#team.defaultTag, this.#tmplSettings.defaultDraftTags];
  }

  get globalTemplateTags() {
    return this.#bvr.globalTags;
  }

  get recordsDraftID() {
    return this.#settings.recordsDraftID;
  }

  get googleFormSettings() {
    return this.#settings.googleFormSettings;
  }

  get msgSettings() {
    return this.#settings.messageSettings;
  }

  get highlights() {
    if (this.#gameData.highlights == undefined) return "";

    return this.#gameData.highlights;
  }

  get comments() {
    if (this.#gameData.comments == undefined) return "";

    return this.#gameData.comments;
  }

  get headCoachName() {
    return this.#bvr.globalTags.hc_name;
  }

  get ui() {
    return this.#bvr.ui;
  }

  createTasks() {
    if (this.thingsProjectTemplate == undefined) return;

    this.recordDate();
    this.recordOpponent();
    this.recordLocation();

    const tmplSettings = this.#generateTmplSettings(this.thingsProjectTemplate);
    const projectTemplate = new Template(tmplSettings);
    const thingsParserAction = Action.find("Things Parser");
    app.queueAction(thingsParserAction, projectTemplate.draft);
  }

  submitReport() {
    const index = this.seasonRecord.findIndex(
      (game) => game.draftID == draft.uuid
    );
    if (index == -1) return;

    this.#loadGameData(index);
    if (this.submitted)
      return this.#bvr.ui.displayAppMessage(
        "info",
        "this game has already been submitted!"
      );

    const { modifiedArray: modifiedDraft, sectionText: comments } =
      this.#extractSection(draft.lines, `## Other/Comments`);
    const { sectionText: highlights } = this.#extractSection(
      modifiedDraft,
      `## Highlights?`
    );

    this.#gameData.comments = comments;
    this.#gameData.highlights = highlights;

    if (this.msgSettings != undefined) this.#sendMessages();
    if (this.googleFormSettings != undefined) this.#submitGoogleForm();
    this.sumbitted = true;
    this.#saveRecordsData();
  }

  #loadGameData(index) {
    this.#gameData = this.seasonRecord[index];
    this.#gameData.date = new Date(this.#gameData.date);
  }

  #sendMessages() {
    this.msgSettings.forEach((msgConfig) =>
      this.#createAndSendMessage(msgConfig)
    );
  }

  #createAndSendMessage(msgConfig) {
    const { templateTags } = this.#generateTmplSettings();
    msgConfig.templateTags = templateTags;

    const message = meesageFactory(msgConfig);
    message.compose();

    if (message.messageText != "") message.send();
  }

  #submitGoogleForm() {
    const formData = {
      ...this.#gameData,
      hcName: this.headCoachName,
      reported: "Not applicable (non-varsity team)",
      scoreUs: this.scoreUs,
      scoreThem: this.scoreThem,
      fullScore: this.fullScore,
      teamName: this.teamName,
      googleFormDate: this.googleFormDate,
    };
    this.ui.debugVariable(formData, "formData: ");
    const dependancies = {
      settings: this.googleFormSettings,
      formData: formData,
    };
    const googleForm = new GoogleForm(dependancies);
    googleForm.submit();
  }

  record() {
    const funcsToRun = [
      "recordDate",
      "recordOpponent",
      "recordLocation",
      "recordScore",
    ];

    this.#gameData.recorded = funcsToRun.every((fn) => {
      return this[fn]();
    });

    if (this.recorded == false) return;
    this.generateReport();
    this.saveGame();
  }

  recordDate() {
    const { menuSettings } = this.#bvr.ui.settings("recordDate");
    const dayOfGame = this.#bvr.ui.buildMenu(menuSettings);
    if (dayOfGame.show() == false) return false;

    const firstValue = menuSettings.menuItems[0]?.data?.value;
    this.#gameData.date =
      dayOfGame.buttonPressed == firstValue
        ? new Date()
        : this.#getDateFromPrompt();

    if (this.date == undefined) return false;

    this.#gameData.formattedDate = this.#bvr.formatDateMDY(this.date);
    this.#readCalendarData();
    return true;
  }

  recordOpponent() {
    const { menuSettings, textField } = this.#bvr.ui.settings("recordOpponent");
    if (this.calOpponent != undefined)
      textField.data.initialText = this.calOpponent;

    menuSettings.menuItems.push(textField);
    const opponentPrompt = this.#bvr.ui.buildMenu(menuSettings);

    if (opponentPrompt.show() == false) return false;

    this.#gameData.opponent = opponentPrompt.fieldValues[textField.data.name];
    return true;
  }

  recordLocation() {
    this.#gameData.location =
      this.calLocation != undefined
        ? this.calLocation
        : this.#getLocationFromPrompt();
    if (this.#gameData.location == undefined) return false;

    return true;
  }

  recordScore() {
    const { menuSettings, pickerData } = this.#bvr.ui.settings("recordScore");
    const pickerColums = this.#pickerColumns(this.sport.maxScore);

    // Build score picker prompt
    pickerData.columns = pickerColums;
    pickerData.selectedRows = this.selectedRows;
    menuSettings.menuItems.push({
      type: "picker",
      data: pickerData,
    });

    const scorePrompt = this.#bvr.ui.buildMenu(menuSettings);
    if (scorePrompt.show() == false) return false;

    // Record score and result
    // fieldValues will be in the format { score: [4,8] } where the array corresponds to index values
    const pickerValues = scorePrompt.fieldValues[pickerData.name];
    this.#gameData.score = pickerValues.map((value, i) => {
      return pickerColums[i][value];
    });
    this.#gameData.result = this.#winLoseOrDraw(this.score);
    return true;
  }

  generateReport() {
    if (this.recorded == false || this.reportTmplSettings == undefined) return;

    const tmplSettings = this.#generateTmplSettings(this.reportTmplSettings);

    this.gameReportDraft = new Template(tmplSettings);
    this.gameReportDraft.archive().save().activate();
    this.#gameData.draftID = this.gameReportDraft.draftID;
    this.#gameData.submitted = false;
  }

  saveGame() {
    if (this.recorded != true) return false;
    this.#saveRecordsData();
    this.#appendToRecordsDraft();
  }

  #saveRecordsData() {
    this.#gameData.descrition = this.description;
    this.seasonRecord = [...this.seasonRecord, this.#gameData];
    this.#records.save();
  }

  #appendToRecordsDraft() {
    if (this.recordsDraftID == undefined) return;

    const recordsDraft = Draft.find(this.recordsDraftID);
    if (recordsDraft == undefined) return;

    const tmplSettings = this.#generateTmplSettings(this.recordTmplSettings);
    const newTableLine = new Template(tmplSettings);

    recordsDraft.append(newTableLine.content);
    recordsDraft.update();
  }

  #generateTmplSettings(settings = {}) {
    const templateSettings = {
      ...settings,
      templateTags: {
        ...this.globalTemplateTags,
        team_name: this.teamName,
        game_date: this.formattedDate,
        game_location: this.location,
        game_opponent: this.opponent,
        game_result: this.result,
        game_score: this.fullScore,
        game_score_us: this.scoreUs,
        game_score_them: this.scoreThem,
        game_description: this.description,
        game_summary: this.summary,
        game_highlights: this.highlights,
        game_comments: this.comments,
      },
    };
    if (templateSettings.draftTags != undefined)
      templateSettings.draftTags = [
        ...this.defaultDraftTags,
        ...templateSettings.draftTags,
      ];
    return templateSettings;
  }

  #pickerColumns(maxValue) {
    const columValues = Array.from({ length: maxValue + 1 }, (e, i) =>
      i.toString()
    );
    return [columValues, columValues];
  }

  #winLoseOrDraw(gameScore) {
    const bvrScore = Number(gameScore[0]);
    const theirScore = Number(gameScore[1]);

    if (bvrScore > theirScore) return "Win";
    if (bvrScore < theirScore) return "Loss";
    return "Draw";
  }

  #getDateFromPrompt() {
    const { menuSettings } = this.#bvr.ui.settings("getDateFromPrompt");
    const datePrompt = this.#bvr.ui.buildMenu(menuSettings);

    if (datePrompt.show() == false) return undefined;

    const fieldName = menuSettings.menuItems[0]?.data?.name;
    return datePrompt.fieldValues[fieldName];
  }

  #getLocationFromPrompt() {
    const { menuSettings } = this.#bvr.ui.settings("getLocationFromPrompt");
    const locationPrompt = this.#bvr.ui.buildMenu(menuSettings);

    locationPrompt.show();

    return locationPrompt.buttonPressed;
  }

  #readCalendarData() {
    const cal = Calendar.find(this.#team.calendar);
    if (cal == undefined) return;

    const startDate = adjustDate(this.date, "-12 hours");
    const endDate = adjustDate(this.date, "+12 hours");

    const events = cal.events(startDate, endDate);
    const matchEvent = events[0]?.title;

    if (matchEvent == undefined || matchEvent.includes("Game") == false) {
      this.#bvr.ui.displayAppMessage(
        "info",
        "There does not appear to be a game today."
      );
      return false;
    }

    const matchDescription = matchEvent.split(":")[1].split("vs");
    const location = matchDescription[0].trim();

    if (this.#validLocation(location)) this.#gameData.calLocation = location;
    this.#gameData.calOpponent = matchDescription[1]?.trim();
  }

  #validLocation(location) {
    const validLocations = ["home", "away"];
    return validLocations.includes(location.toLowerCase());
  }

  #lookupDraftID() {
    if (this.seasonRecord.find((game) => game.draftID == draft.uuid))
      return draft.uuid;
    return "";
    //return this.#getDraftIDFromPrompt();
  }

  #extractSection(array, sectionHeader) {
    const { sectionStart, sectionEnd } = this.#getSectionData(
      array,
      sectionHeader
    );
    const sectionText = array
      .splice(sectionStart, sectionEnd)
      .slice(2)
      .join("");
    return { modifiedArray: array, sectionText: sectionText };
  }

  #getSectionData(array, text) {
    return {
      sectionStart: array.findIndex((item) => item == text),
      sectionEnd: array.length,
    };
  }
}
