class Team {
  #bvr;
  #weekID;
  #ppData;
  #settings;
  #teamData;

  constructor(teamID = "") {
    this.#bvr = new BVR();
    this.#settings = new Settings(this.#bvr.teamSettingsFile);

    this.#teamData = this.#getTeamData(teamID);

    this.attendace = new Attendance(this.dependancies);
    this.practicePlan = new PracticePlan(this.dependancies);
    this.game = new Game(this.dependancies);
  }

  get dependancies() {
    return { bvr: this.#bvr, team: this };
  }

  get teamsData() {
    return this.#settings.teamsData;
  }

  // Team Settings
  get id() {
    return this.#teamData.id;
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
    return this.#teamData.attendanceDraftID;
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
    return this.#teamData.teamTemplateTags;
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

  get templateSettings() {
    if (this.#teamData.templateSettings != undefined)
      return this.#teamData.templateSettings;

    const settingsFile =
      this.#teamData.templateSettingsFile == undefined
        ? `${this.id}/templateSettings.yaml`
        : this.#teamData.templateSettingsFile;
    return new Settings(`${this.#bvr.dirPrefix}${settingsFile}`);
  }

  get defualtTag() {
    return this.#teamData.defualtTag;
  }

  createWelcomeLetter() {
    if (this.#teamData.welcomeLetter == undefined) return;

    const settings = this.#teamData.welcomeLetter;
    settings.templateTags = {
      ...this.globatTags,
      ...this.teamTemplateTags,
      team_name: this.name,
    };

    this.#bvr.createDraftFromTemplate(settings);
  }

  createPracticePlan() {
    this.practicePlan.create();
  }

  loadPracticePlan() {
    this.practicePlan.load();
  }

  takeAttendace() {
    return this.attendace.take();
  }

  submitAttendace() {
    this.attendace.submit();
  }

  recordGameScore() {
    this.game.record();
  }

  submitGameReport() {
    this.game.submitReport();
  }

  createGameDayTasks() {
    this.game.createTasks();
  }

  archiveNotes() {
    const teamNotes = Draft.query("", "archive", [this.defualtTag]);
    teamNotes.every((note) => this.#processNote(note));
  }

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
    const teamData = this.teamsData.filter((team) =>
      draft.hasTag(team.defualtTag)
    )[0];
    if (teamData != undefined) return teamData;

    const id = teamID == "" ? this.#getTeamIDFromPrompt() : teamID;
    return this.teamsData.filter((team) => team.id == id)[0];
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
}
