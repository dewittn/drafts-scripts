class Attendance {
  #bvr;
  #team;
  #settings;
  #displayMsgs;

  constructor(dependancies) {
    if (dependancies == undefined)
      dependancies = {
        bvr: new BVR(),
        team: new Team(),
      };

    this.#bvr = dependancies.bvr;
    this.#team = dependancies.team;
    this.#settings = this.#team.attendanceSettings;
    this.#displayMsgs = this.#bvr.ui.settings("displayMsgs");
    this.names = [];
  }

  get ui() {
    return this.#bvr.ui;
  }

  get absencesMsgConfig() {
    if (this.#settings.absencesMsgConfig == undefined) return undefined;

    return {
      ...this.#settings.absencesMsgConfig,
      msgTemplateTag: this.msgTeamNameTag,
      attendaceDraft: this.attendaceDraft,
      templateTags: {
        ...this.globalTemplateTags,
        team_name: this.teamName,
      },
    };
  }

  get noAbsencesMsgConfig() {
    if (this.#settings.noAbsencesMsgConfig == undefined) return undefined;

    return {
      ...this.#settings.noAbsencesMsgConfig,
      msgTemplateTag: this.msgTeamNameTag,
      attendaceDraft: this.attendaceDraft,
      templateTags: {
        ...this.globalTemplateTags,
        team_name: this.teamName,
      },
    };
  }

  get msgTeamNameTag() {
    return this.#bvr.msgTeamNameTag;
  }

  get teamName() {
    return this.#team.name;
  }

  get attendanceDraftID() {
    return this.#team.attendanceDraftID;
  }

  get hasBeenRecorded() {
    return /\[x\]/.test(this.attendaceDraft.lines[3]);
  }

  get hasBeenSubmitted() {
    return /\[x\]/.test(this.attendaceDraft.lines[4]);
  }

  get attendaceDraftIsLoaded() {
    return draft.uuid == this.attendaceDraft.uuid;
  }

  get submitSuccess() {
    return this.#displayMsgs.submitSuccess;
  }

  get submitFailure() {
    return this.#displayMsgs.submitFailure;
  }

  get noOneAbsentMSG() {
    return this.#displayMsgs.noOneAbsent;
  }

  get alreadySubmitted() {
    return this.#displayMsgs.alreadySubmitted;
  }

  get globalTemplateTags() {
    return this.#bvr.globalTags;
  }

  get noOneAbsent() {
    return this.names.length == 0;
  }

  loadDraft() {
    if (draft.uuid == this.attendanceDraftID) return draft;
    return Draft.find(this.attendanceDraftID);
  }

  take() {
    this.#loadAttendaceDraft();
    if (this.attendaceDraftIsLoaded == false) return false;

    const attendaceDraftReset = this.#resetAttendanceDraft();
    this.#bvr.pinDraft(this.attendaceDraft);
    if (attendaceDraftReset) return false;

    if (this.hasBeenSubmitted) {
      this.#bvr.ui.displayAppMessage("info", this.alreadySubmitted);
      return false;
    }

    const { menuSettings } = this.#bvr.ui.settings("attendaceIsReady");
    if (this.hasBeenRecorded == false) {
      const takeNow = this.#bvr.ui.buildMenu(menuSettings);
      if (takeNow.show() == false || takeNow.buttonPressed == "no")
        return false;
    }

    const regEx = /\[ \]/g;
    const lines = this.attendaceDraft.lines.slice(
      5,
      this.attendaceDraft.lines.length
    ); // split into lines

    lines.forEach((line) => {
      if (line.match(regEx)) this.names.push(this.#bvr.cleanUpName(line));
    });

    return true;
  }

  submit() {
    const msgConfig = this.noOneAbsent
      ? this.noAbsencesMsgConfig
      : this.absencesMsgConfig;

    if (msgConfig != undefined) {
      const message = meesageFactory(msgConfig);
      message.compose(this.names);

      if (message.send() == false)
        return this.#bvr.ui.displayAppMessage("error", this.submitFailure);
    }

    this.submitted();
  }

  #loadAttendaceDraft() {
    if (this.attendanceDraftID == undefined)
      return alert(
        "Error in #loadAttendaceDraft(): attendanceDraftID is undefined!"
      );
    this.attendaceDraft = Draft.find(this.attendanceDraftID);
  }

  submitted() {
    this.#runAttendaceShortcut();
    this.attendaceDraft.content = this.attendaceDraft.content
      .replace(/- \[ \] Recorded/g, "- [x] Recorded")
      .replace(/- \[ \] Submitted/g, "- [x] Submitted");
    this.attendaceDraft.update();
    this.#bvr.unpinDraft(this.attendaceDraft);
    this.#bvr.ui.displayAppMessage("success", this.submitSuccess);
    this.#team.loadPracticePlan();
  }

  #runAttendaceShortcut() {
    const shortcutAction = Action.find("Mark Attendace As Complete");
    const shortcutDraft = new Draft();

    shortcutDraft.content = this.#team.abbr;
    app.queueAction(shortcutAction, shortcutDraft);
  }

  #resetAttendanceDraft() {
    const dateMatch = /\d{4}-\d{2}-\d{2}/;
    const dateField = this.attendaceDraft.lines[2];
    const lastTaken = dateMatch.exec(dateField);
    const today = this.#bvr.formatDateYMD(new Date());

    if (lastTaken != today) {
      this.attendaceDraft.tasks.forEach((task) =>
        this.attendaceDraft.resetTask(task)
      );
      this.attendaceDraft.content = this.attendaceDraft.content.replace(
        lastTaken,
        today
      );

      this.attendaceDraft.update();
      return true;
    }

    return false;
  }
}
