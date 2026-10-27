class Attendance {
  #bvr;
  #team;
  #settings;
  #displayMsgs;
  #dependencies;

  constructor(dependencies) {
    // Store dependencies but don't instantiate if not provided
    this.#dependencies = dependencies;

    if (dependencies != undefined) {
      this.#bvr = dependencies.bvr;
      this.#team = dependencies.team;
    }

    this.names = [];
  }

  get bvr() {
    if (!this.#bvr && this.#dependencies == undefined) {
      if (typeof BVR == "undefined") require("modules/bvr/core/BVR.js");
      this.#bvr = new BVR();
    }
    return this.#bvr;
  }

  get team() {
    if (!this.#team && this.#dependencies == undefined) {
      if (typeof Team == "undefined") require("modules/bvr/core/Team.js");
      this.#team = new Team();
    }
    return this.#team;
  }

  get settings() {
    if (!this.#settings) {
      this.#settings = this.team.attendanceSettings;
    }
    return this.#settings;
  }

  get displayMsgs() {
    if (!this.#displayMsgs) {
      this.#displayMsgs = this.bvr.ui.settings("displayMsgs");
    }
    return this.#displayMsgs;
  }

  get ui() {
    return this.bvr.ui;
  }

  get absencesMsgConfig() {
    if (this.settings.absencesMsgConfig == undefined) return undefined;

    return {
      ...this.settings.absencesMsgConfig,
      msgTemplateTag: this.msgTeamNameTag,
      attendaceDraft: this.attendaceDraft,
      templateTags: {
        ...this.globalTemplateTags,
        team_name: this.teamName,
      },
    };
  }

  get noAbsencesMsgConfig() {
    if (this.settings.noAbsencesMsgConfig == undefined) return undefined;

    return {
      ...this.settings.noAbsencesMsgConfig,
      msgTemplateTag: this.msgTeamNameTag,
      attendaceDraft: this.attendaceDraft,
      templateTags: {
        ...this.globalTemplateTags,
        team_name: this.teamName,
      },
    };
  }

  get msgTeamNameTag() {
    return this.bvr.msgTeamNameTag;
  }

  get teamName() {
    return this.team.name;
  }

  get attendanceDraftID() {
    return this.team.attendanceDraftID;
  }

  get hasBeenRecorded() {
    return /\[x\]/.test(this.attendaceDraft.lines[3]);
  }

  get hasBeenSubmitted() {
    return /\[x\]/.test(this.attendaceDraft.lines[4]);
  }

  // Submitted stays checked until the next Record Attendance resets the
  // draft, so also check the draft is dated today.
  get wasSubmittedToday() {
    const today = this.bvr.formatDateYMD(new Date());
    return this.hasBeenSubmitted && this.attendaceDraft.lines[2].includes(today);
  }

  get isBusList() {
    return this.attendaceDraft.lines[2].includes(Attendance.busListMarker);
  }

  get attendaceDraftIsLoaded() {
    return draft.uuid == this.attendaceDraft.uuid;
  }

  get submitSuccess() {
    return this.displayMsgs.submitSuccess;
  }

  get submitFailure() {
    return this.displayMsgs.submitFailure;
  }

  get noOneAbsentMSG() {
    return this.displayMsgs.noOneAbsent;
  }

  get alreadySubmitted() {
    return this.displayMsgs.alreadySubmitted;
  }

  get globalTemplateTags() {
    return this.bvr.globalTags;
  }

  get noOneAbsent() {
    return this.names.length == 0;
  }

  // The attendance draft, as the global draft when the action was run on it
  // (see DraftsRuntime.findDraft).
  loadDraft() {
    if (typeof DraftsRuntime == "undefined") require("shared/libraries/DraftsRuntime.js");
    return DraftsRuntime.findDraft(this.attendanceDraftID);
  }

  take() {
    this.#loadAttendaceDraft();

    const attendaceDraftReset = this.#resetAttendanceDraft();
    this.bvr.pinDraft(this.attendaceDraft);
    if (attendaceDraftReset) return false;

    if (this.hasBeenSubmitted) {
      this.bvr.ui.displayAppMessage("info", this.alreadySubmitted);
      return false;
    }

    const { menuSettings } = this.bvr.ui.settings("attendaceIsReady");
    if (this.hasBeenRecorded == false) {
      const takeNow = this.bvr.ui.buildMenu(menuSettings);
      if (takeNow.show() == false || takeNow.buttonPressed == "no") {
        return false;
      }
    }

    const regEx = /\[ \]/g;
    const lines = this.attendaceDraft.lines.slice(
      5,
      this.attendaceDraft.lines.length,
    ); // split into lines

    lines.forEach((line) => {
      if (line.match(regEx)) this.names.push(this.bvr.cleanUpName(line));
    });

    return true;
  }

  // dryRun skips the attendance message and the completion shortcut so the
  // draft update can be tested without side effects.
  submit({ dryRun = false } = {}) {
    const msgConfig = this.noOneAbsent
      ? this.noAbsencesMsgConfig
      : this.absencesMsgConfig;

    if (msgConfig != undefined && dryRun == false) {
      const message = meesageFactory(msgConfig);
      message.compose(this.names);

      if (message.send() == false) {
        return this.bvr.ui.displayAppMessage("error", this.submitFailure);
      }
    }

    this.submitted({ dryRun });
  }

  // Turn today's attendance into the bus list home, or back again. Players
  // who were absent or are picked up get checked, so the unchecked names are
  // the ones riding the bus.
  toggleBusList() {
    this.#loadAttendaceDraft();
    if (this.wasSubmittedToday == false) {
      return this.ui.displayAppMessage("info", this.displayMsgs.busListNotReady);
    }

    const content = Attendance.flipBusList(this.attendaceDraft.content);

    // Same editor and draft handling as submitted().
    editor.load(this.attendaceDraft);
    editor.setText(content);
    this.attendaceDraft.content = content;
    this.attendaceDraft.update();

    const message = this.isBusList ? this.displayMsgs.busListOn : this.displayMsgs.busListOff;
    this.ui.displayAppMessage("info", message);
  }

  // Added to the date line while the draft is the bus list.
  static busListMarker = " · Bus home";

  // Attendance content with every player's checkbox flipped and the bus list
  // marker added to or removed from the date line. Lines follow
  // bvr/attendance.md: the date is line 2, players start at line 5, so the
  // Recorded and Submitted checkboxes are never flipped.
  static flipBusList(content) {
    return `${content}`
      .split("\n")
      .map((line, index) => {
        if (index == 2) return Attendance.toggleBusListMarker(line);
        if (index < 5) return line;
        return Attendance.flipCheckbox(line);
      })
      .join("\n");
  }

  static toggleBusListMarker(dateLine) {
    if (dateLine.includes(Attendance.busListMarker)) {
      return dateLine.replace(Attendance.busListMarker, "");
    }
    return dateLine.replace(/_$/, `${Attendance.busListMarker}_`);
  }

  static flipCheckbox(line) {
    if (line.startsWith("- [x]")) return line.replace("- [x]", "- [ ]");
    if (line.startsWith("- [ ]")) return line.replace("- [ ]", "- [x]");
    return line;
  }

  #loadAttendaceDraft() {
    if (this.attendanceDraftID == undefined) {
      return alert(
        "Error in #loadAttendaceDraft(): attendanceDraftID is undefined!",
      );
    }
    this.attendaceDraft = this.loadDraft();
  }

  submitted({ dryRun = false } = {}) {
    if (dryRun == false) this.#runAttendaceShortcut();
    const content = this.attendaceDraft.content
      .replace(/- \[ \] Recorded/g, "- [x] Recorded")
      .replace(/- \[ \] Submitted/g, "- [x] Submitted");

    // The attendance draft is loaded in the editor (see pinDraft in take()),
    // so keep the editor buffer and the draft object in agreement.
    editor.setText(content);
    this.attendaceDraft.content = content;
    this.attendaceDraft.update();
    this.bvr.unpinDraft(this.attendaceDraft);
    this.bvr.ui.displayAppMessage("success", this.submitSuccess);
    this.team.loadPracticePlan();
  }

  #runAttendaceShortcut() {
    const shortcutAction = Action.find("Mark Attendace As Complete");
    const shortcutDraft = new Draft();

    shortcutDraft.content = this.team.abbr;
    app.queueAction(shortcutAction, shortcutDraft);
  }

  #resetAttendanceDraft() {
    const dateMatch = /\d{4}-\d{2}-\d{2}/;
    const dateField = this.attendaceDraft.lines[2];
    const lastTaken = dateMatch.exec(dateField)?.[0];
    const today = this.bvr.formatDateYMD(new Date());

    if (lastTaken != today) {
      this.attendaceDraft.tasks.forEach((task) =>
        this.attendaceDraft.resetTask(task)
      );
      // A new day starts as attendance, even if the last one ended as the
      // bus list.
      this.attendaceDraft.content = this.attendaceDraft.content
        .replace(lastTaken, today)
        .replace(Attendance.busListMarker, "");

      this.attendaceDraft.update();
      return true;
    }

    return false;
  }
}
