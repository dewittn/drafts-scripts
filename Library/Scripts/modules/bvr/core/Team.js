if (typeof ServiceContainer == "undefined") require("shared/core/ServiceContainer.js");

class Team {
  #bvr;
  #weekID;
  #ppData;
  #settings;
  #teamData;
  #tmplSettings;
  #services;
  #attendance;
  #season;
  #config;

  // allTeams: pick from every team, not just the active ones (Start New
  // Season, whose team is usually between seasons).
  constructor(teamID = "", { allTeams = false } = {}) {
    this.#services = ServiceContainer.getInstance();

    // Register BVR service if not already registered
    if (!this.#services.has('bvr')) {
      this.#services.register('bvr', () => {
        if (typeof BVR == "undefined") require("modules/bvr/core/BVR.js");
        return new BVR();
      }, true);
    }

    this.#teamData = this.#getTeamData(teamID, allTeams);
  }

  // Lazy getters for dependencies
  get bvr() {
    if (!this.#bvr) {
      this.#bvr = this.#services.get('bvr');
    }
    return this.#bvr;
  }

  get settings() {
    if (!this.#settings) {
      if (typeof Settings == "undefined") require("modules/cp/filesystems/CloudFS.js");
      this.#settings = new Settings(this.bvr.teamSettingsFile);
    }
    return this.#settings;
  }

  get tmplSettings() {
    if (!this.#tmplSettings) {
      this.#tmplSettings = this.config.templateSettings;
    }
    return this.#tmplSettings;
  }

  // This team's settings, merged from its level, its teams.yaml entry, the
  // school-wide forms, and the staff directory.
  get config() {
    if (!this.#config) {
      if (this.#teamData.level == undefined) {
        throw new Error(`teams.yaml: ${this.id} has no level (ms or us)`);
      }
      this.#config = new TeamConfig({
        team: this.#teamData,
        level: this.bvr.levelSettings(this.#teamData.level),
        forms: this.bvr.forms,
        staff: this.bvr.staff,
        attendanceOffice: this.bvr.attendanceOffice,
        templateExists: (file) => new CloudFS(Template.basePath).exists(file),
      });
    }
    return this.#config;
  }

  get attendace() {
    if (!this.#attendance) {
      if (typeof Attendance == "undefined") require("modules/bvr/core/Attendance.js");
      this.#attendance = new Attendance(this.dependencies);
    }
    return this.#attendance;
  }

  set attendace(value) {
    this.#attendance = value;
  }

  get season() {
    if (!this.#season) {
      if (typeof Season == "undefined") require("modules/bvr/core/Season.js");
      this.#season = new Season(this.dependencies);
    }
    return this.#season;
  }

  set season(value) {
    this.#season = value;
  }

  // **********************
  // Getter/Setter
  // **********************

  get ui() {
    return this.bvr.ui;
  }

  get dependencies() {
    return { bvr: this.bvr, team: this, tmplSettings: this.tmplSettings };
  }

  get teamsData() {
    return this.settings.teamsData;
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

  // The current season's roster draft if it has one, else teams.yaml's.
  get attendanceDraftID() {
    const seasonDraft = this.season.currentSeasonData?.attendanceDraftID;
    return seasonDraft ? seasonDraft : this.#teamData.attendanceDraftID;
  }

  get tags() {
    return this.#teamData.defualtTags;
  }

  get startDate() {
    return this.#teamData.startDate;
  }

  // "fall" or "spring" from teams.yaml; names new seasons (2026-fall).
  get seasonName() {
    return this.#teamData.season;
  }

  get calendar() {
    return this.#teamData.calendar;
  }

  get reportTmplSettings() {
    return this.#teamData.gameReport;
  }

  get teamTemplateTags() {
    const teamTags = this.tmplSettings.teamTemplateTags;
    return teamTags != undefined ? teamTags : {};
  }

  // Message settings use the current season's recipient lists when it has
  // them. Read only when sending, so building the config never needs the
  // season (which itself needs the template settings).
  get gameReportSettings() {
    return this.#seasonConfig.gameReportSettings;
  }

  get attendanceSettings() {
    return this.#seasonConfig.attendanceSettings;
  }

  get #seasonConfig() {
    return this.config.withSeasonRecipients(this.season.currentSeasonData?.recipients);
  }

  // Who gets attendance and score messages without a season override.
  get defaultRecipients() {
    return this.config.defaultRecipients;
  }

  // The score forms this team submits, by name (see forms.yaml).
  get formNames() {
    return this.config.formNames;
  }

  // A form's title and fields, for prompts.
  form(name) {
    return this.config.form(name);
  }

  get defaultTag() {
    return this.#teamData.defaultTag;
  }

  get welcomeLetterData() {
    return this.tmplSettings.welcomeLetter;
  }

  get defaultDraftTags() {
    return [this.defaultTag];
  }

  get globalTemplateTags() {
    return this.#bvr.globalTags;
  }

  // Every template built from these settings reads the season ID and label,
  // so this is where a run first picks its season storage (and shows the
  // "not migrated" message for a team without a team file).
  get gblTmplSettings() {
    return {
      teamName: this.name,
      teamAbbr: this.abbr,
      teamLevel: this.#teamData.level,
      defaultDraftTags: this.defaultDraftTags,
      globalTemplateTags: this.globalTemplateTags,
      teamTemplateTags: this.teamTemplateTags,
      currentSeasonID: this.season.currentSeasonID,
      currentSeasonLabel: this.season.currentSeasonLabel,
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
      tmplSettings,
    );
    const welcomeLetter = new Template(welcomeLetterSettings);
    welcomeLetter.archive().save().activate();
  }

  createPracticePlan() {
    const practicePlan = new PracticePlan(this.dependencies);
    practicePlan.create();
  }

  loadPracticePlan() {
    const practicePlan = new PracticePlan(this.dependencies);
    practicePlan.load();
  }

  takeAttendace() {
    return this.attendace.take();
  }

  submitAttendace(options) {
    this.attendace.submit(options);
  }

  gameRecordResult() {
    const game = new Game(this.dependencies);
    game.recordResult();
    game.generateReport();
  }

  submitGameReport() {
    const game = new Game(this.dependencies);
    game.submitReport();
  }

  // Edit Game, run on a game report draft: change its opponent, location,
  // or score.
  editGame() {
    if (typeof Game == "undefined") require("modules/bvr/core/Game.js");
    const game = new Game(this.dependencies);
    game.editGame();
  }

  createGameDayTasks() {
    if (this.tmplSettings?.thingsProject == undefined) {
      return this.ui.displayAppMessage("info", "No game day tasks found.");
    }

    if (typeof Game == "undefined") require("modules/bvr/core/Game.js");
    const game = new Game(this.dependencies);
    game.recordDate();
    game.recordOpponent();
    game.recordLocation();

    const tmplSettings = game.generateTmplSettings("thingsProject");
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    const projectTemplate = new Template(tmplSettings);
    const thingsParserAction = Action.find("Things Parser");
    app.queueAction(thingsParserAction, projectTemplate.draft);
  }

  // The end-of-season checklist as a Things project, for the last week or
  // two of the season. The template leaves out upper-school-only items for
  // middle school teams ({{#level_us}}).
  createEndOfSeasonTasks() {
    const tmplSettings = new TmplSettings(this.gblTmplSettings, this.tmplSettings.endOfSeasonProject);
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    const projectTemplate = new Template(tmplSettings);
    const thingsParserAction = Action.find("Things Parser");
    app.queueAction(thingsParserAction, projectTemplate.draft);
  }

  archiveNotes() {
    const teamNotes = Draft.query("", "archive", this.defaultDraftTags);
    if (teamNotes == undefined) {
      return this.ui.displayAppMessage("info", "No team drafts were found!");
    }
    teamNotes.every((note) => this.#processNote(note));
  }

  startNewSeason() {
    this.season.startNewSeason();
  }

  editSeason() {
    this.season.editCurrentSeason();
  }

  insertPlayerName() {
    const { menuSettings, pickerData } = this.bvr.ui.settings(
      "insertPlayerName",
    );
    this.attendaceDraft = Draft.find(this.attendanceDraftID);

    const names = this.attendaceDraft.tasks
      .map((task) => this.bvr.cleanUpName(task.line))
      .slice(2);

    pickerData.columns = [names];
    menuSettings.menuItems.push({
      type: "picker",
      data: pickerData,
    });

    const playerPrompt = this.bvr.ui.buildMenu(menuSettings);
    if (playerPrompt.show() == false) return editor.activate();

    const pickerValue = playerPrompt.fieldValues[pickerData.name][0];
    const playerName = names[pickerValue];

    this.#insertTextPosAtEnd(`${playerName} `);
  }

  // Carry the roster kept from last season into the current one: retitle it
  // for the season and move everyone up a grade, after showing the result.
  // Run after Start New Season, in any month.
  updateRoster() {
    if (!this.season.ensureCurrentSeason()) return;

    const attendaceDraft = Draft.find(this.attendanceDraftID);
    if (attendaceDraft == undefined) {
      return this.ui.displayAppMessage("error", `${this.name} has no roster draft.`);
    }

    const title = `# Attendance: ${this.abbr} ${this.season.currentSeasonLabel}`;
    const updatedContent = Team.promoteRoster(attendaceDraft.content, title);
    if (updatedContent == undefined) {
      return this.ui.displayAppMessage("info", "Roster has already been updated!");
    }

    const { menuSettings } = this.bvr.ui.settings("updateRoster");
    menuSettings.menuItems.push({
      type: "label",
      data: {
        name: "content",
        label: updatedContent,
        options: {
          textSize: "body",
        },
      },
    });
    const rosterPrompt = this.ui.buildMenu(menuSettings);
    if (rosterPrompt.show() == false) return;

    if (rosterPrompt.buttonPressed == "yes") {
      attendaceDraft.content = updatedContent;
      attendaceDraft.update();
      editor.load(attendaceDraft);
    }
  }

  // The roster with its first line replaced by title and every "(grade)"
  // moved up one, or undefined when the first line is already title (the
  // roster was updated for this season).
  static promoteRoster(content, title) {
    const [firstLine, ...rest] = `${content}`.split("\n");
    if (firstLine.trim() == title) return undefined;

    const promoted = rest.map((line) => line.replace(/\((\d+)\)/, (match, grade) => `(${Number(grade) + 1})`));
    return [title, ...promoted].join("\n");
  }

  // **********************
  // Private Functions
  // **********************

  #processNote(workingDraft) {
    const { menuSettings, tempMessage } = this.bvr.ui.settings("notePrompt");
    menuSettings.menuMessage = `${tempMessage}\n\n${workingDraft.displayTitle}`;

    const notePrompt = this.bvr.ui.buildMenu(menuSettings);

    if (notePrompt.show() == false) return false;
    if (notePrompt.buttonPressed == "leave") return true;

    bearTags(workingDraft);
    updateWikiLinks(workingDraft);
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
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

  // The draft's team tag wins, then a team ID passed in, then a choice.
  #getTeamData(teamID, allTeams) {
    const teamData = this.#getTeamDataFromTag();
    if (teamData != undefined) return teamData;

    const id = teamID == "" ? this.#chooseTeamID(allTeams) : teamID;
    return this.teamsData.filter((team) => team.id == id)[0];
  }

  #getTeamDataFromTag() {
    return this.teamsData.filter((team) => draft.hasTag(team.defaultTag))[0];
  }

  // Choose from the active teams, using the only one without asking. With no
  // active team (or allTeams), every team is offered. A team between seasons
  // is still reachable by running the action from one of its tagged drafts.
  #chooseTeamID(allTeams) {
    if (allTeams) return this.#getTeamIDFromPrompt(this.teamsData);

    const activeTeams = this.#activeTeams();
    if (activeTeams.length == 0) return this.#getTeamIDFromPrompt(this.teamsData, { noneActive: true });
    if (activeTeams.length > 1) return this.#getTeamIDFromPrompt(activeTeams);

    const [onlyTeam] = activeTeams;
    this.bvr.ui.displayAppMessage("info", `Using ${onlyTeam.name}.`);
    return onlyTeam.id;
  }

  // Teams whose current season has not reached its last day. A team file
  // that cannot be read counts as inactive here; an action run from one of
  // that team's drafts reports the problem.
  #activeTeams() {
    if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
    const today = this.bvr.formatDateYMD(new Date());
    return this.teamsData.filter((team) => {
      try {
        return TeamFileStore.load(this.bvr.teamFilePath(team.id))?.isActiveOn(today) == true;
      } catch (error) {
        return false;
      }
    });
  }

  #getTeamIDFromPrompt(teams, { noneActive = false } = {}) {
    const { menuSettings, noneActiveMessage } = this.bvr.ui.settings("getTeamIDFromPrompt");
    if (noneActive) menuSettings.menuMessage = noneActiveMessage;
    teams.forEach((team) =>
      menuSettings.menuItems.push({
        type: "button",
        data: { name: team.name, value: team.id },
      })
    );
    const selectMenu = this.bvr.ui.buildMenu(menuSettings);

    selectMenu.show();
    return selectMenu.buttonPressed;
  }

  #insertTextPosAtEnd(text) {
    editor.setSelectedText(text);
    editor.setSelectedRange(
      editor.getSelectedRange()[0] + editor.getSelectedRange()[1],
      0,
    );
    editor.activate();
  }
}
