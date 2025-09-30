if (typeof ServiceContainer == "undefined") require("core/ServiceContainer.js");

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

  constructor(teamID = "") {
    this.#services = ServiceContainer.getInstance();

    // Register BVR service if not already registered
    if (!this.#services.has('bvr')) {
      this.#services.register('bvr', () => {
        if (typeof BVR == "undefined") require("bvr/BVR.js");
        return new BVR();
      }, true);
    }

    this.#teamData = this.#getTeamData(teamID);
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
      if (typeof Settings == "undefined") require("libraries/Settings.js");
      this.#settings = new Settings(this.bvr.teamSettingsFile);
    }
    return this.#settings;
  }

  get tmplSettings() {
    if (!this.#tmplSettings) {
      this.#tmplSettings = this.#loadTemplateSettings();
    }
    return this.#tmplSettings;
  }

  get attendace() {
    if (!this.#attendance) {
      if (typeof Attendance == "undefined") require("bvr/Attendance.js");
      this.#attendance = new Attendance(this.dependencies);
    }
    return this.#attendance;
  }

  set attendace(value) {
    this.#attendance = value;
  }

  get season() {
    if (!this.#season) {
      if (typeof Season == "undefined") require("bvr/Season.js");
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
    if (this.#teamData.gameReportSettings != undefined) {
      return this.#teamData.gameReportSettings;
    }

    const settingsFile = this.#teamData.gameReportSettingsFile == undefined
      ? `${this.id}/gameReportSettings.yaml`
      : this.#teamData.gameReportSettings;
    if (typeof Settings == "undefined") require("libraries/Settings.js");
    return new Settings(`${this.bvr.dirPrefix}${settingsFile}`);
  }

  get attendanceSettings() {
    if (this.#teamData.attendanceSettings != undefined) {
      return this.#teamData.attendanceSettings;
    }

    const settingsFile = this.#teamData.attendanceSettingsFile == undefined
      ? `${this.id}/attendanceSettings.yaml`
      : this.#teamData.attendanceSettingsFile;
    if (typeof Settings == "undefined") require("libraries/Settings.js");
    return new Settings(`${this.bvr.dirPrefix}${settingsFile}`);
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

  submitAttendace() {
    this.attendace.submit();
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

  createGameDayTasks() {
    if (this.tmplSettings?.thingsProject == undefined) {
      return this.ui.displayAppMessage("info", "No game day tasks found.");
    }

    if (typeof Game == "undefined") require("bvr/Game.js");
    const game = new Game(this.dependencies);
    game.recordDate();
    game.recordOpponent();
    game.recordLocation();

    const tmplSettings = game.generateTmplSettings("thingsProject");
    if (typeof Template == "undefined") require("cp/templates/Template.js");
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

  migrateCurrentSeason() {
    this.season.migrateCurrentSeason();
  }

  startNewSeason() {
    this.season.startNewSeason();
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

  updateRoster() {
    const { menuSettings } = this.bvr.ui.settings("updateRoster");
    const attendaceDraft = Draft.find(this.attendanceDraftID);

    const currentYear = new Date().getFullYear();
    const yearPattern = new RegExp(`(\\d{4})`);
    const yearMatch = attendaceDraft.lines[0].match(yearPattern);
    const foundYear = parseInt(yearMatch[1], 10);

    // Check if the found year matches the current year
    if (foundYear !== currentYear) {
      return this.ui.displayAppMessage(
        "info",
        "Roster has already been updated!",
      );
    }

    // Increment the year and append "(Potential)"
    const newYear = foundYear + 1;

    const updatedContent = attendaceDraft.lines
      .map((line, index) => {
        if (index === 0) {
          return line.replace(yearPattern, newYear) + " (Potential)";
        }

        // Use a regular expression to find the number in parentheses
        const gradeMatch = line.match(/\((\d+)\)/);

        if (!gradeMatch) return line;

        // Extract the number, convert it to an integer, and increment it by 1
        let number = parseInt(gradeMatch[1], 10);
        number += 1;

        // Replace the original number in the string with the incremented number
        const updatedLine = line.replace(/\(\d+\)/, `(${number})`);
        return updatedLine;
      })
      .join("\n");

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
    if (typeof Template == "undefined") require("cp/templates/Template.js");
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
    const { menuSettings } = this.bvr.ui.settings("getTeamIDFromPrompt");
    this.teamsData.forEach((team) =>
      menuSettings.menuItems.push({
        type: "button",
        data: { name: team.name, value: team.id },
      })
    );
    const selectMenu = this.bvr.ui.buildMenu(menuSettings);

    selectMenu.show();
    return selectMenu.buttonPressed;
  }

  #loadTemplateSettings() {
    if (this.#teamData.templateSettings != undefined) {
      return this.#teamData.templateSettings;
    }

    const settingsFile = this.#teamData.templateSettingsFile == undefined
      ? `${this.id}/templateSettings.yaml`
      : this.#teamData.templateSettingsFile;
    if (typeof Settings == "undefined") require("libraries/Settings.js");
    return new Settings(`${this.bvr.dirPrefix}${settingsFile}`);
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
