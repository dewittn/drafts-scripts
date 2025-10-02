class Game {
  #bvr;
  #team;
  #gameData = {};
  #settings;
  #tmplSettings;
  #currentSeasonID;
  #sport;
  #dependencies;

  constructor(dependencies, uuid = draft.uuid) {
    // Store dependencies but don't instantiate BVR/Team if not provided
    // This allows lazy initialization
    this.#dependencies = dependencies;

    if (dependencies != undefined) {
      this.#bvr = dependencies.bvr;
      this.#team = dependencies.team;
      this.#tmplSettings = dependencies.tmplSettings;
    }

    this.#gameData = this.#loadGameDataFromUUID(uuid);
  }

  get bvr() {
    if (!this.#bvr && this.#dependencies == undefined) {
      if (typeof BVR == "undefined") require("./BVR.js");
      this.#bvr = new BVR();
    }
    return this.#bvr;
  }

  get team() {
    if (!this.#team && this.#dependencies == undefined) {
      if (typeof Team == "undefined") require("./Team.js");
      this.#team = new Team();
    }
    return this.#team;
  }

  get sport() {
    if (!this.#sport) {
      if (typeof Sport == "undefined") require("./Sport.js");
      this.#sport = new Sport(this.teamPlays);
    }
    return this.#sport;
  }

  set sport(value) {
    this.#sport = value;
  }

  get settings() {
    if (!this.#settings) {
      this.#settings = this.team.gameReportSettings;
    }
    return this.#settings;
  }

  // **********************
  // Getter/Setter
  // **********************

  get ui() {
    return this.bvr.ui;
  }

  get teamID() {
    return this.team.id;
  }

  get teamName() {
    return this.team.name;
  }

  get teamPlays() {
    return this.team.plays;
  }

  get selectedRows() {
    return [this.sport.selectedValue, this.sport.selectedValue];
  }

  get result() {
    return this.#gameData.result;
  }

  get opponent() {
    return this.#gameData.opponent;
  }

  get submitted() {
    return this.#gameData.submitted;
  }

  set submitted(value) {
    this.#gameData.submitted = value;
  }

  get draftID() {
    return this.#gameData.draftID;
  }

  set draftID(value) {
    this.#gameData.draftID = value;
  }

  get date() {
    if (this.#gameData?.date == undefined) return new Date();
    return this.#gameData.date;
  }

  set date(value) {
    this.#gameData.date = value;
  }

  get formattedDate() {
    if (this.#gameData.formattedDate == undefined) return "";

    return this.#gameData.formattedDate;
  }

  get reportDueDate() {
    if (this.date == undefined) return "";

    return this.bvr.formatDateMDY(adjustDate(this.date, "+1 day"));
  }

  get googleFormDate() {
    const gameDate = new Date(this.date);
    return this.bvr.formatDateYMD(gameDate);
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

  get isHome() {
    return this.location == "Home";
  }

  get summary() {
    if (this.recorded == false) return "No game recorded.";

    return `${this.teamName} recorded a ${this.result?.toLowerCase()} ${this.locationGrammar} against ${this.opponent}, with a score of ${this.fullScore} on ${this.formattedDate}.`;
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
    return this.settings.googleFormSettings;
  }

  get msgSettings() {
    return this.settings.messageSettings;
  }

  get highlights() {
    if (this.#gameData.highlights == undefined) return "";

    return this.#gameData.highlights;
  }

  set highlights(value) {
    this.#gameData.highlights = value;
  }

  get comments() {
    if (this.#gameData.comments == undefined) return "";

    return this.#gameData.comments;
  }

  set comments(value) {
    this.#gameData.comments = value;
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

  get currentSeasonRecord() {
    return this.team.season.currentSeasonRecord;
  }

  get recorded() {
    if (this.#gameData.recorded == undefined) return false;

    return this.#gameData.recorded;
  }

  set recorded(value) {
    this.#gameData.recorded = value;
  }

  get appended() {
    if (this.#gameData.appended == undefined) return false;

    return this.#gameData.appended;
  }

  set appended(value) {
    this.#gameData.appended = value;
  }

  // **********************
  // Templating Getter/Setter
  // **********************

  get headCoachName() {
    return this.bvr.globalTags.hc_name;
  }

  get gblTmplSettings() {
    return this.team.gblTmplSettings;
  }

  get tmplSettingsGameReport() {
    return this.generateTmplSettings("gameReport");
  }

  get tmplSettingsRecordRow() {
    return this.generateTmplSettings("recordRow");
  }

  get tmplSettingsMessage() {
    return this.generateTmplSettings("Message");
  }

  // **********************
  // Public Functions
  // **********************

  recordResult() {
    const funcsToRun = [
      "recordDate",
      "recordOpponent",
      "recordLocation",
      "recordScore",
    ];

    this.recorded = funcsToRun.every((fn) => {
      return this[fn]();
    });

    if (this.recorded == false) return;
  }

  recordDate() {
    const { menuSettings } = this.bvr.ui.settings("recordDate");
    const dayOfGame = this.bvr.ui.buildMenu(menuSettings);
    if (dayOfGame.show() == false) return false;

    const firstValue = menuSettings.menuItems[0]?.data?.value;
    this.date = dayOfGame.buttonPressed == firstValue
      ? new Date()
      : this.#getDateFromPrompt();

    if (this.date == undefined) return false;

    this.#gameData.formattedDate = this.bvr.formatDateMDY(this.date);
    this.#readCalendarData();
    return true;
  }

  recordOpponent() {
    const { menuSettings, textField } = this.bvr.ui.settings("recordOpponent");
    if (this.calOpponent != undefined) {
      textField.data.initialText = this.calOpponent;
    }

    menuSettings.menuItems.push(textField);
    const opponentPrompt = this.bvr.ui.buildMenu(menuSettings);

    if (opponentPrompt.show() == false) return false;

    this.#gameData.opponent = opponentPrompt.fieldValues[textField.data.name];
    return true;
  }

  recordLocation() {
    this.#gameData.location = this.calLocation != undefined
      ? this.calLocation
      : this.#getLocationFromPrompt();
    if (this.#gameData.location == undefined) return false;

    return true;
  }

  recordScore() {
    const { menuSettings, pickerData } = this.bvr.ui.settings("recordScore");
    const pickerColums = this.#pickerColumns(this.sport.maxScore);

    // Build score picker prompt
    pickerData.columns = pickerColums;
    pickerData.selectedRows = this.selectedRows;
    menuSettings.menuItems.push({
      type: "picker",
      data: pickerData,
    });

    const scorePrompt = this.bvr.ui.buildMenu(menuSettings);
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

  toJSON() {
    return {
      calOpponent: this.calOpponent,
      calLocation: this.calLocation,
      opponent: this.opponent,
      location: this.location,
      date: this.date,
      score: this.score,
      result: this.result,
      formattedDate: this.formattedDate,
      descrition: this.descrition,
      draftID: this.draftID,
      highlights: this.highlights,
      comments: this.comments,
      recorded: this.recorded,
      appended: this.appended,
      submitted: this.submitted,
    };
  }

  toGoogleFormData() {
    return {
      teamName: this.teamName,
      hcName: this.headCoachName,
      formattedDate: this.formattedDate,
      opponent: this.opponent,
      result: this.result,
      fullScore: this.fullScore,
      highlights: this.highlights,
      reported: "Not applicable (non-varsity team)",
      comments: this.comments,
      scoreUs: this.scoreUs,
      scoreThem: this.scoreThem,
      googleFormDate: this.googleFormDate,
    };
  }

  // **********************
  // Private Functions
  // **********************

  #loadGameDataFromUUID(uuid) {
    if (uuid == undefined) return {};

    const index = this.currentSeasonRecord.findIndex(
      (game) => game.draftID == uuid,
    );
    if (index == -1) return {};

    const gameData = this.currentSeasonRecord[index];
    gameData.date = new Date(gameData.date);
    return gameData;
  }

  #lookupDraftID() {
    if (this.seasonRecord.find((game) => game.draftID == draft.uuid)) {
      return draft.uuid;
    }
    return "";
  }

  #pickerColumns(maxValue) {
    const columValues = Array.from(
      { length: maxValue + 1 },
      (e, i) => i.toString(),
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
    const { menuSettings } = this.bvr.ui.settings("getDateFromPrompt");
    const datePrompt = this.bvr.ui.buildMenu(menuSettings);

    if (datePrompt.show() == false) return undefined;

    const fieldName = menuSettings.menuItems[0]?.data?.name;
    return datePrompt.fieldValues[fieldName];
  }

  #getLocationFromPrompt() {
    const { menuSettings } = this.bvr.ui.settings("getLocationFromPrompt");
    const locationPrompt = this.bvr.ui.buildMenu(menuSettings);

    locationPrompt.show();

    return locationPrompt.buttonPressed;
  }

  #readCalendarData() {
    const cal = Calendar.find(this.team.calendar);
    if (cal == undefined) return;

    const startDate = adjustDate(this.date, "-12 hours");
    const endDate = adjustDate(this.date, "+12 hours");

    const events = cal.events(startDate, endDate);
    const matchEvent = events[0]?.title;

    if (matchEvent == undefined || matchEvent.includes("Game") == false) {
      this.bvr.ui.displayAppMessage(
        "info",
        "There does not appear to be a game today.",
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

  // **********************
  // Game Report Functions
  // **********************

  generateReport() {
    if (this.recorded == false || this.tmplSettingsGameReport == undefined) {
      return;
    }

    const gameReportDraft = new Template(this.tmplSettingsGameReport);
    gameReportDraft.archive().save().activate();
    this.draftID = gameReportDraft.draftID;
    this.submitted = false;
    this.#updateSeasonRecord();
  }

  submitReport() {
    if (this.submitted) {
      this.ui.displayAppMessage(
        "info",
        "this game has already been submitted!",
      );
      const menuSettings = {
        menuTitle: "Game Already submitted",
        menuMessage: "Would you like to submit it anyway?",
      };

      if (this.ui.yesNoPrompt(menuSettings) == "no") return;
    }

    const gameReportDraft = Draft.find(this.draftID);
    if (gameReportDraft == undefined) {
      return this.ui.displayAppMessage(
        "error",
        "gameReportDraft could not be found",
        { draftID: this.draftID },
      );
    }

    const { modifiedArray: modifiedDraft, sectionText: comments } = this
      .#extractSectionText(gameReportDraft.lines, `## Other/Comments`);
    const { sectionText: highlights } = this.#extractSectionText(
      modifiedDraft,
      `## Highlights?`,
    );

    this.comments = comments;
    this.highlights = highlights;

    if (this.msgSettings != undefined) this.#sendMessages();
    if (this.googleFormSettings != undefined) {
      this.googleFormSettings.forEach((gform) => this.#submitGoogleForm(gform));
    }

    this.submitted = true;
    this.#updateSeasonRecord();
  }

  generateTmplSettings(key) {
    const tmplSettings = this.#tmplSettings?.[key] != undefined
      ? this.#tmplSettings[key]
      : {};
    if (typeof TmplSettings == "undefined") require("../utils/TmplSettings.js");
    return new TmplSettings(this.gblTmplSettings, tmplSettings, this);
  }

  #updateSeasonRecord() {
    this.team.season.updateWith(this);
  }

  #sendMessages() {
    this.msgSettings.forEach((msgConfig) =>
      this.#createAndSendMessage(msgConfig)
    );
  }

  #createAndSendMessage(msgConfig) {
    msgConfig.templateTags = this.tmplSettingsMessage?.templateTags;
    const message = meesageFactory(msgConfig);
    message.compose();

    if (message.messageText != "") message.send();
  }

  #submitGoogleForm(gformSettings) {
    const { menuSettings } = this.ui.settings("submitGoogleForm");
    const dependencies = {
      settings: gformSettings,
      formData: this.toGoogleFormData(),
    };

    const googleForm = new GoogleForm(dependencies);
    googleForm.submit();

    const formSubmittedPrompt = this.ui.buildMenu(menuSettings);
    formSubmittedPrompt.show();
  }

  #extractSectionText(array, sectionHeader) {
    const { sectionStart, sectionEnd } = this.#getSectionStartEnd(
      array,
      sectionHeader,
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
}
