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

  // The attendance form (forms.yaml) when the level or team names one, as
  // upper school does. Undefined for a team that only sends messages.
  get formSettings() {
    return this.settings.formSettings;
  }

  // The one option of the form's "all athletes are present" checkbox, as
  // forms.yaml lists it, since the form only accepts that exact text.
  get allPresentAnswer() {
    const field = this.formSettings.fields.find((formField) => formField.key == "allPresent");
    return field?.options?.[0];
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

  // The attendance form first when the level has one, then the attendance
  // message when it has one, then the draft is marked submitted. Stops,
  // leaving the draft as it was, when either one does not go through.
  // dryRun skips the attendance message and the completion shortcut so the
  // draft update can be tested without side effects. It still opens the
  // form, since an opened form sends nothing until submitted by hand.
  submit({ dryRun = false } = {}) {
    if (this.formSettings != undefined && this.#submitAttendanceForm() == false) return;
    if (this.#sendAttendanceMessage({ dryRun }) == false) return;

    this.submitted({ dryRun });
  }

  // The level's absences or no-absences message. True when it was sent or
  // there is none to send (or on a dry run).
  #sendAttendanceMessage({ dryRun }) {
    const msgConfig = this.noOneAbsent
      ? this.noAbsencesMsgConfig
      : this.absencesMsgConfig;
    if (msgConfig == undefined || dryRun) return true;

    const message = meesageFactory(msgConfig);
    message.compose(this.names);

    if (message.send() == false) {
      this.bvr.ui.displayAppMessage("error", this.submitFailure);
      return false;
    }
    return true;
  }

  // **********************
  // Attendance form
  // **********************

  // Fill in the attendance form and open it to review and submit by hand. It
  // is never posted from here: it is a school form, so nothing may reach it
  // without the coach pressing Submit. True once the coach says it was
  // submitted; false when there is no link, the unexcused prompt is
  // cancelled, or the coach says it was not.
  #submitAttendanceForm() {
    const url = this.#attendanceFormURL();
    if (url == undefined) return false;

    const unexcused = this.#pickUnexcused();
    if (unexcused == undefined) return false;

    this.#openAttendanceForm(url, unexcused);
    return this.#confirmFormSubmitted();
  }

  // This term's link to the form, asked for once per term and shared by the
  // term's teams (Season.ensureFormURL). Undefined, with a message, for a
  // team with no current season or when no link is given.
  #attendanceFormURL() {
    const season = this.team.season;
    if (!season.ensureCurrentSeason()) return undefined;

    const url = season.ensureFormURL(this.formSettings.name);
    if (url == undefined) {
      const title = this.formSettings.title || this.formSettings.name;
      this.ui.displayAppMessage("info", `No ${title} link for this season, so attendance was not submitted.`);
    }
    return url;
  }

  // The absent players whose absence is unexcused, checked in a prompt that
  // lists only the absent ones. Absences are excused unless checked. Empty
  // when no one is absent (no prompt); undefined when cancelled.
  #pickUnexcused() {
    if (this.noOneAbsent) return [];
    return this.#pickPlayers(this.names, "attendanceForm");
  }

  // The prefilled form in the browser. postData is forced off so a forms.yaml
  // edit can never make this submit the form directly.
  #openAttendanceForm(url, unexcused) {
    const formData = {
      hcName: this.globalTemplateTags.hc_name,
      teamName: this.settings.formTeam,
      ...Attendance.absenceFormData(this.names, unexcused, this.allPresentAnswer),
    };

    if (typeof GoogleForm == "undefined") require("modules/bvr/services/GoogleForm.js");
    const googleForm = new GoogleForm({
      settings: { ...this.formSettings, url, postData: false },
      formData,
    });
    googleForm.submit();
  }

  // Asked after the form opens, so the draft is marked submitted (and the
  // completion shortcut queued) only once the coach has sent the form.
  #confirmFormSubmitted() {
    const { submittedPrompt } = this.ui.settingsCopy("attendanceForm");
    if (this.ui.yesNoPrompt(submittedPrompt) == "yes") return true;

    this.ui.displayAppMessage("info", this.displayMsgs.formNotSubmitted);
    return false;
  }

  // The form's absence answers: the all-present box when no one is absent,
  // else the absent players split into excused and unexcused, each a
  // comma-separated list. Unused answers are undefined, so GoogleForm leaves
  // those fields blank.
  static absenceFormData(absentNames, unexcusedNames, allPresentAnswer) {
    if (absentNames.length == 0) {
      return { allPresent: allPresentAnswer, excused: undefined, unexcused: undefined };
    }

    const isUnexcused = (name) => unexcusedNames.includes(name);
    const listed = (names) => (names.length > 0 ? names.join(", ") : undefined);
    return {
      allPresent: undefined,
      excused: listed(absentNames.filter((name) => !isUnexcused(name))),
      unexcused: listed(absentNames.filter(isUnexcused)),
    };
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

  // Copy Player Names: pick players from the attendance draft and copy them
  // as a "- Name" list to paste elsewhere. The draft is left as it is, since
  // its checkboxes are today's attendance or the bus list.
  copyPlayerNames() {
    this.#loadAttendaceDraft();
    const names = Attendance.playerLines(this.attendaceDraft.content).map((line) => this.bvr.cleanUpName(line));

    const picked = this.#pickPlayers(names, "copyPlayerNames");
    if (picked == undefined) return;
    if (picked.length == 0) return this.ui.displayAppMessage("info", this.displayMsgs.noPlayersPicked);

    app.setClipboard(Attendance.nameList(picked));
    this.ui.displayAppMessage("success", `Copied ${picked.length} ${picked.length == 1 ? "name" : "names"}.`);
  }

  // A checklist of the players, in roster order, worded by a ui.yaml section
  // with menuSettings and playerSelect. Undefined when cancelled.
  #pickPlayers(names, uiSection) {
    const { menuSettings, playerSelect } = this.ui.settingsCopy(uiSection);
    playerSelect.data.values = names;
    menuSettings.menuItems.push(playerSelect);

    const prompt = this.ui.buildMenu(menuSettings);
    if (prompt.show() == false) return undefined;
    return prompt.fieldValues[playerSelect.data.name] || [];
  }

  // The player lines of attendance content: checkboxes from line 5 on (see
  // bvr/attendance.md) that have a name, checked or not.
  static playerLines(content) {
    return `${content}`
      .split("\n")
      .slice(5)
      .filter((line) => /^- \[[ x]\]\s*\S/.test(line));
  }

  // Names as a Markdown list, one "- Name" per line.
  static nameList(names) {
    return names.map((name) => `- ${name}`).join("\n");
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
