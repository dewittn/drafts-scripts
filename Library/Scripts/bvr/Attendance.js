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

  get msgConfig() {
    return {
      ...this.#settings.msgConfig,
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

  get noOneAbsent() {
    return this.#displayMsgs.noOneAbsent;
  }

  get alreadySubmitted() {
    return this.#displayMsgs.alreadySubmitted;
  }

  get globalTemplateTags() {
    return this.#bvr.globalTags;
  }

  loadDraft() {
    if (draft.uuid == this.attendanceDraftID) return draft;
    return Draft.find(this.attendanceDraftID);
  }

  take() {
    this.#loadAttendaceDraft();
    if (this.attendaceDraftIsLoaded == false) return false;

    if (this.hasBeenSubmitted) {
      app.displayInfoMessage(this.alreadySubmitted);
      return false;
    }

    const { menuSettings } = this.#bvr.ui.settings("attendaceIsReady");
    if (this.hasBeenRecorded == false) {
      const takeNow = this.#bvr.ui.buildMenu(menuSettings);
      if (takeNow.show() == false || takeNow.buttonPressed == "no") return false;
    }

    const regEx = /\[ \]/g;
    const lines = this.attendaceDraft.lines.slice(5, this.attendaceDraft.lines.length); // split into lines

    lines.forEach((line) => {
      if (line.match(regEx)) this.names.push(this.#bvr.cleanUpName(line));
    });

    if (this.names.length == 0) {
      this.submitted();
      app.displayInfoMessage(this.noOneAbsent);

      return false;
    }
    return true;
  }

  submit() {
    const message = meesageFactory(this.msgConfig);
    message.compose(this.names);

    if (message.send() == false) return app.displayErrorMessage(this.submitFailure);
    this.submitted();
  }

  #loadAttendaceDraft() {
    this.attendaceDraft = Draft.find(this.attendanceDraftID);

    const dateMatch = /\d{4}-\d{2}-\d{2}/;
    const dateField = this.attendaceDraft.lines[2];
    const lastTaken = dateMatch.exec(dateField);
    const today = this.#bvr.formatDateYMD(new Date());

    if (lastTaken != today) {
      this.attendaceDraft.content = this.attendaceDraft.content.replace(/\[x\]/g, "[ ]").replace(lastTaken, today);
      this.attendaceDraft.update();
    }

    this.#bvr.pinDraft(this.attendaceDraft);
  }

  submitted() {
    this.attendaceDraft.content = this.attendaceDraft.content
      .replace(/- \[ \] Recorded/g, "- [x] Recorded")
      .replace(/- \[ \] Submitted/g, "- [x] Submitted");
    this.attendaceDraft.update();

    this.#bvr.unpinDraft(this.attendaceDraft);

    this.#bvr.ui.displaySuccessMessage(this.submitSuccess);
    this.#team.loadPracticePlan();
  }
}
