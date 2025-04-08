class Team {
  #bvr;
  #weekID;
  #ppData;
  #settings;
  #teamData;
  #tmplSettings;

  constructor(teamID = "") {
    this.#bvr = new BVR();
    this.#settings = new Settings(this.#bvr.teamSettingsFile);
    this.#teamData = this.#getTeamData(teamID);
    this.#tmplSettings = this.#loadTemplateSettings();

    this.attendace = new Attendance(this.dependancies);
    this.season = new Season(this.dependancies);
  }

  // **********************
  // Getter/Setter
  // **********************

  get ui() {
    return this.#bvr.ui;
  }

  get dependancies() {
    return { bvr: this.#bvr, team: this, tmplSettings: this.#tmplSettings };
  }

  get teamsData() {
    return this.#settings.teamsData;
  }

  // Team Settings
  get id() {
    return this.#teamData.id;
  }

  get abbr() {
    return this.#teamData.abbr;
  }

  get plays() {
    return this.#teamData.sport;
  }

  get name() {
    return this.#teamData.name;
  }

  get msgConfig() {
    return this.#teamData.msgConfig;
  }

  get attendanceDraftID() {
    return this.#teamData.attendanceDraftID != undefined
      ? this.#teamData.attendanceDraftID
      : this.attendanceSettings.attendanceDraftID;
  }

  get tags() {
    return this.#teamData.defualtTags;
  }

  get startDate() {
    return this.#teamData.startDate;
  }

  get calendar() {
    return this.#teamData.calendar;
  }

  get reportTmplSettings() {
    return this.#teamData.gameReport;
  }

  get teamTemplateTags() {
    const teamTags = this.#tmplSettings.teamTemplateTags;
    return teamTags != undefined ? teamTags : {};
  }

  get gameReportSettings() {
    if (this.#teamData.gameReportSettings != undefined)
      return this.#teamData.gameReportSettings;

    const settingsFile =
      this.#teamData.gameReportSettingsFile == undefined
        ? `${this.id}/gameReportSettings.yaml`
        : this.#teamData.gameReportSettings;
    return new Settings(`${this.#bvr.dirPrefix}${settingsFile}`);
  }

  get attendanceSettings() {
    if (this.#teamData.attendanceSettings != undefined)
      return this.#teamData.attendanceSettings;

    const settingsFile =
      this.#teamData.attendanceSettingsFile == undefined
        ? `${this.id}/attendanceSettings.yaml`
        : this.#teamData.attendanceSettingsFile;
    return new Settings(`${this.#bvr.dirPrefix}${settingsFile}`);
  }

  get defaultTag() {
    return this.#teamData.defaultTag;
  }

  get welcomeLetterData() {
    return this.#tmplSettings.welcomeLetter;
  }

  get defaultDraftTags() {
    return [this.defaultTag];
  }

  get globalTemplateTags() {
    return this.#bvr.globalTags;
  }

  get gblTmplSettings() {
    return {
      teamName: this.name,
      teamAbbr: this.abbr,
      defaultDraftTags: this.defaultDraftTags,
      globalTemplateTags: this.globalTemplateTags,
      teamTemplateTags: this.teamTemplateTags,
      currentSeasonID: this.season.currentSeasonID,
    };
  }

  // **********************
  // Public Functions
  // **********************

  createWelcomeLetter() {
    if (this.welcomeLetterData == undefined) return;

    const tmplSettings = this.welcomeLetterData;
    const welcomeLetterSettings = new TmplSettings(
      this.gblTmplSettings,
      tmplSettings
    );
    const welcomeLetter = new Template(welcomeLetterSettings);
    welcomeLetter.archive().save().activate();
  }

  createPracticePlan() {
    const practicePlan = new PracticePlan(this.dependancies);
    practicePlan.create();
  }

  loadPracticePlan() {
    const practicePlan = new PracticePlan(this.dependancies);
    practicePlan.load();
  }

  takeAttendace() {
    return this.attendace.take();
  }

  submitAttendace() {
    this.attendace.submit();
  }

  gameRecordResult() {
    const game = new Game(this.dependancies);
    game.recordResult();
    game.generateReport();
  }

  submitGameReport() {
    const game = new Game(this.dependancies);
    game.submitReport();
  }

  createGameDayTasks() {
    if (this.#tmplSettings?.thingsProject == undefined) return;

    const game = new Game(this.dependancies);
    game.recordDate();
    game.recordOpponent();
    game.recordLocation();

    const tmplSettings = game.generateTmplSettings("thingsProject");
    const projectTemplate = new Template(tmplSettings);
    const thingsParserAction = Action.find("Things Parser");
    app.queueAction(thingsParserAction, projectTemplate.draft);
  }

  archiveNotes() {
    const teamNotes = Draft.query("", "archive", this.defaultDraftTags);
    if (teamNotes == undefined)
      return this.ui.displayAppMessage("info", "No team drafts were found!");
    teamNotes.every((note) => this.#processNote(note));
  }

  migrateCurrentSeason() {
    this.season.migrateCurrentSeason();
  }

  startNewSeason() {
    this.season.startNewSeason();
  }

  insertPlayerName() {
    const { menuSettings, pickerData } =
      this.#bvr.ui.settings("insertPlayerName");
    this.attendaceDraft = Draft.find(this.attendanceDraftID);

    const names = this.attendaceDraft.tasks
      .map((task) => this.#bvr.cleanUpName(task.line))
      .slice(2);

    pickerData.columns = [names];
    menuSettings.menuItems.push({
      type: "picker",
      data: pickerData,
    });

    const playerPrompt = this.#bvr.ui.buildMenu(menuSettings);
    if (playerPrompt.show() == false) return editor.activate();

    const pickerValue = playerPrompt.fieldValues[pickerData.name][0];
    const playerName = names[pickerValue];

    this.#insertTextPosAtEnd(`${playerName} `);
  }

  // **********************
  // Private Functions
  // **********************

  #processNote(workingDraft) {
    const { menuSettings, tempMessage } = this.#bvr.ui.settings("notePrompt");
    menuSettings.menuMessage = `${tempMessage}\n\n${workingDraft.displayTitle}`;

    const notePrompt = this.#bvr.ui.buildMenu(menuSettings);

    if (notePrompt.show() == false) return false;
    if (notePrompt.buttonPressed == "leave") return true;

    bearTags(workingDraft);
    updateWikiLinks(workingDraft);
    const bearTemplate = Template.load("bear-note.md");
    const bearNote = workingDraft.processTemplate(bearTemplate);

    if (this.#sendNoteToBear(bearNote) == false) return false;
    workingDraft.isTrashed = true;
    workingDraft.update();
    return true;
  }

  #sendNoteToBear(note) {
    const bearURL = `bear://x-callback-url/create`;

    const cb = CallbackURL.create();
    cb.baseURL = bearURL;
    cb.waitForResponse = false;
    cb.addParameter("text", note);

    return cb.open();
  }

  #getTeamData(teamID) {
    const teamData = this.#getTeamDataFromTag();
    if (teamData != undefined) return teamData;

    const id = teamID == "" ? this.#getTeamIDFromPrompt() : teamID;
    return this.teamsData.filter((team) => team.id == id)[0];
  }

  #getTeamDataFromTag() {
    return this.teamsData.filter((team) => draft.hasTag(team.defaultTag))[0];
  }

  #getTeamIDFromPrompt() {
    const { menuSettings } = this.#bvr.ui.settings("getTeamIDFromPrompt");
    this.teamsData.forEach((team) =>
      menuSettings.menuItems.push({
        type: "button",
        data: { name: team.name, value: team.id },
      })
    );
    const selectMenu = this.#bvr.ui.buildMenu(menuSettings);

    selectMenu.show();
    return selectMenu.buttonPressed;
  }

  #loadTemplateSettings() {
    if (this.#teamData.templateSettings != undefined)
      return this.#teamData.templateSettings;

    const settingsFile =
      this.#teamData.templateSettingsFile == undefined
        ? `${this.id}/templateSettings.yaml`
        : this.#teamData.templateSettingsFile;
    return new Settings(`${this.#bvr.dirPrefix}${settingsFile}`);
  }

  #insertTextPosAtEnd(text) {
    editor.setSelectedText(text);
    editor.setSelectedRange(
      editor.getSelectedRange()[0] + editor.getSelectedRange()[1],
      0
    );
    editor.activate();
  }
}
