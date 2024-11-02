class Game {
  #bvr;
  #team;
  #gameData = {};
  #settings;
  #tmplSettings;
  #currentSeasonID;

  constructor(dependancies, uuid = draft.uuid) {
    if (dependancies == undefined)
      dependancies = {
        bvr: new BVR(),
        team: new Team(),
      };

    this.#bvr = dependancies.bvr;
    this.#team = dependancies.team;

    this.sport = new Sport(this.teamPlays);
    this.#settings = this.gameReportSettings;
    this.#tmplSettings = dependancies.templateSettings;
    this.#gameData = this.#loadGameDataFromUUID(uuid);
  }

  // **********************
  // Getter/Setter
  // **********************

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

  get gblTmplSettings() {
    return this.#team.gblTmplSettings;
  }

  get templateSettings() {
    return this.#team.templateSettings;
  }

  get gameReportSettings() {
    return this.#team.gameReportSettings;
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
    return this.#team.season.currentSeasonRecord;
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

  // **********************
  // Public Functions
  // **********************

  updateSeasonRecord() {
    this.#team.season.updateWith(this);
  }

  generateReport() {
    const tmplSettings = this.#generateTmplSettings(this.gameReportSettings);
    const gameReport = this.#createGameReport(tmplSettings);
    gameReport.generate();
  }

  submitReport() {
    const tmplSettings = this.#generateTmplSettings(this.gameReportSettings);
    const gameReport = this.#createGameReport(tmplSettings);
    gameReport.submit();
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

  // **********************
  // Private Functions
  // **********************

  #loadGameDataFromUUID(uuid) {
    if (uuid == undefined) return {};
    const index = this.currentSeasonRecord.findIndex(
      (game) => game.draftID == uuid
    );
    if (index == -1) return {};

    const gameData = this.currentSeasonRecord[index];
    gameData.date = new Date(this.#gameData.date);
    return gameData;
  }

  #lookupDraftID() {
    if (this.seasonRecord.find((game) => game.draftID == draft.uuid))
      return draft.uuid;
    return "";
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

  #generateTmplSettings(tmplSettings) {
    return new TmplSettings(this.gblTmplSettings, tmplSettings, this);
  }

  #createGameReport(tmplSettings) {
    return new GameReport({
      game: this,
      tmplSettings: tmplSettings,
    });
  }
}
