class Game {
  #bvr;
  #team;
  #gameData = {};
  #settings;
  #tmplSettings;
  #currentSeasonID;

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
    this.#tmplSettings = this.templateSettings;
  }

  get ui() {
    return this.#bvr.ui;
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

  // **********************
  // Score Report Getter/Setter
  // **********************

  get gameReportSettings() {
    return this.#team.gameReportSettings;
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

  get selectedRows() {
    return [this.sport.selectedValue, this.sport.selectedValue];
  }

  // **********************
  // Templating Getter/Setter
  // **********************

  get headCoachName() {
    return this.#bvr.globalTags.hc_name;
  }

  get gameReportTmplSettings() {
    return this.#tmplSettings.gameReport;
  }

  get thingsProject() {
    return this.#tmplSettings.thingsProject;
  }

  get defaultDraftTags() {
    return [this.#team.defaultTag];
  }

  get globalTemplateTags() {
    return this.#bvr.globalTags;
  }

  createTasks() {
    if (this.thingsProject == undefined) return;

    this.recordDate();
    this.recordOpponent();
    this.recordLocation();

    const tmplSettings = this.#generateTmplSettings(this.thingsProject);
    const projectTemplate = new Template(tmplSettings);
    const thingsParserAction = Action.find("Things Parser");
    app.queueAction(thingsParserAction, projectTemplate.draft);
  }

  recordResult() {
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
    if (this.recorded == false || this.gameReportTmplSettings == undefined)
      return;

    const tmplSettings = this.#generateTmplSettings(
      this.gameReportTmplSettings
    );

    this.gameReportDraft = new Template(tmplSettings);
    this.gameReportDraft.archive().save().activate();
    this.#gameData.draftID = this.gameReportDraft.draftID;
    this.#gameData.submitted = false;
  }

  submitReport() {
    if (this.#loadGameDataFromUUID() == false) return;

    if (this.submitted)
      return this.#bvr.ui.displayAppMessage(
        "info",
        "this game has already been submitted!"
      );

    const { modifiedArray: modifiedDraft, sectionText: comments } =
      this.#extractSectionText(draft.lines, `## Other/Comments`);
    const { sectionText: highlights } = this.#extractSectionText(
      modifiedDraft,
      `## Highlights?`
    );

    this.#gameData.comments = comments;
    this.#gameData.highlights = highlights;

    if (this.msgSettings != undefined) this.#sendMessages();
    if (this.googleFormSettings != undefined) this.#submitGoogleForm();
    this.sumbitted = true;
    this.#team.season.updateWith(this.#gameData);
  }

  #loadGameDataFromUUID(uuid = draft.uuid) {
    const index = this.currentSeasonRecord.findIndex(
      (game) => game.draftID == uuid
    );
    if (index == -1) return false;

    this.#gameData = this.currentSeasonRecord[index];
    this.#gameData.date = new Date(this.#gameData.date);
    return true;
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
    const dependancies = {
      settings: this.googleFormSettings,
      formData: formData,
    };

    const googleForm = new GoogleForm(dependancies);
    googleForm.submit();
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
  }

  #extractSectionText(array, sectionHeader) {
    const { sectionStart, sectionEnd } = this.#getSectionStartEnd(
      array,
      sectionHeader
    );
    const sectionText = array
      .splice(sectionStart, sectionEnd)
      .slice(2)
      .join("");
    return { modifiedArray: array, sectionText: sectionText };
  }

  #getSectionStartEnd(array, text) {
    return {
      sectionStart: array.findIndex((item) => item == text),
      sectionEnd: array.length,
    };
  }

  #generateTmplSettings(settings = {}) {
    const templateSettings = {
      ...settings,
      templateTags: {
        ...this.globalTemplateTags,
        team_name: this.teamName,
        current_season: `${this.currentSeasonID}`,
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
    templateSettings.draftTags =
      templateSettings.draftTags == undefined
        ? this.defaultDraftTags
        : [...this.defaultDraftTags, ...templateSettings.draftTags];
    return templateSettings;
  }
}
