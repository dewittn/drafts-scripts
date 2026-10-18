if (typeof Team == "undefined") require("modules/bvr/core/Team.js");
if (typeof Game == "undefined") require("modules/bvr/core/Game.js");
if (typeof Sport == "undefined") require("modules/bvr/core/Sport.js");
if (typeof Season == "undefined") require("modules/bvr/core/Season.js");
// if (typeof BVRUtilities == "undefined") require("modules/bvr/utils/BVRUtilities.js");
if (typeof GoogleForm == "undefined") require("modules/bvr/services/GoogleForm.js");
if (typeof Attendance == "undefined") require("modules/bvr/core/Attendance.js");
if (typeof PracticePlan == "undefined") require("modules/bvr/core/PracticePlan.js");
if (typeof TmplSettings == "undefined") require("modules/bvr/utils/TmplSettings.js");
if (typeof Staff == "undefined") require("modules/bvr/utils/Staff.js");
if (typeof TeamConfig == "undefined") require("modules/bvr/utils/TeamConfig.js");
if (typeof Bear == "undefined") require("shared/libraries/bear.js");
if (typeof DraftsUI == "undefined") require("shared/libraries/DraftsUI.js");
if (typeof CloudFS == "undefined") require("modules/cp/filesystems/CloudFS.js");
if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
if (typeof ServiceContainer == "undefined") require("shared/core/ServiceContainer.js");
require("modules/bvr/messages/message_factory.js");

class BVR {
  static settingsFile = "bvr/settings.json";
  #settings;
  #ui;
  #services;
  #staff;
  #forms;
  #globalTags;

  constructor() {
    this.#services = ServiceContainer.getInstance();

    // Register services if not already registered
    if (!this.#services.has('bvrSettings')) {
      this.#services.register('bvrSettings', () => {
        if (typeof Settings == "undefined") require("modules/cp/filesystems/CloudFS.js");
        return new Settings(this.settingsFile);
      }, true);
    }

    if (!this.#services.has('bvrUI')) {
      this.#services.register('bvrUI', (c) => {
        if (typeof DraftsUI == "undefined") require("shared/libraries/DraftsUI.js");
        const settings = c.get('bvrSettings');
        return new DraftsUI(settings.ui);
      }, true);
    }

    this.#loadWorkspace();
  }

  get settings() {
    if (!this.#settings) {
      this.#settings = this.#services.get('bvrSettings');
    }
    return this.#settings;
  }

  get ui() {
    if (!this.#ui) {
      this.#ui = this.#services.get('bvrUI');
      this.#ui.debug = true;
    }
    return this.#ui;
  }

  set ui(value) {
    this.#ui = value;
  }

  get settingsFile() {
    return this.constructor.settingsFile;
  }

  get uiSettings() {
    return this.settings.ui;
  }

  get dirPrefix() {
    return this.settings.dirPrefix != undefined
      ? this.settings.dirPrefix
      : "";
  }

  get teamSettingsFile() {
    return `${this.dirPrefix}${this.settings.teamSettingsFile}`;
  }

  get ppSettingsFile() {
    return `${this.dirPrefix}${this.settings.ppSettingsFile}`;
  }

  get defaultTemplateFile() {
    return this.settings.defaultTemplateFile;
  }

  get msgTeamNameTag() {
    return this.settings.msgTeamNameTag;
  }

  get weekIDTemplateTag() {
    return this.settings.weekIDTemplateTag;
  }

  get workspace() {
    return this.settings.workspace;
  }

  get ppDataFile() {
    const dataFile = this.settings.ppDataFile == undefined
      ? `practicePlans.json`
      : this.settings.ppDataFile;

    return `${this.dirPrefix}${dataFile}`;
  }

  get ppData() {
    if (this.settings.ppData != undefined) return this.settings.ppData;

    return new DataFile(this.ppDataFile);
  }

  get coachingDraftID() {
    return this.settings.coachingDraftID;
  }

  get recordsFile() {
    return `${this.dirPrefix}${this.settings.recordsFile}`;
  }

  // Folder of per-team season files (see docs/reference/bvr-team-file.md).
  get teamFilesDir() {
    const dir = this.settings.teamFilesDir == undefined
      ? "teams/"
      : this.settings.teamFilesDir;
    return `${this.dirPrefix}${dir}`;
  }

  // Score-form links shared per term (see FormLinkStore).
  get formLinksFile() {
    const file = this.settings.formLinksFile == undefined ? "formLinks.json" : this.settings.formLinksFile;
    return `${this.dirPrefix}${file}`;
  }

  teamFilePath(teamID) {
    return `${this.teamFilesDir}${teamID}.json`;
  }

  // The staff directory (bvr/staff.json), loaded once per run.
  get staff() {
    if (!this.#staff) this.#staff = Staff.load(`${this.dirPrefix}${this.settings.staffFile}`);
    return this.#staff;
  }

  // School-wide score forms by name (bvr/forms.json).
  get forms() {
    if (!this.#forms) this.#forms = DataFile.load(`${this.dirPrefix}${this.settings.formsFile}`);
    return this.#forms;
  }

  get attendanceOffice() {
    return this.settings.attendanceOffice;
  }

  // A level's defaults (bvr/levels/<level>.json). Throws for an unknown
  // level so a typo in teams.yaml names itself.
  levelSettings(level) {
    const data = DataFile.load(`${this.dirPrefix}${this.settings.levelsDir}${level}.json`);
    if (data == undefined) throw new Error(`No settings for level "${level}" (levels/${level}.yaml)`);
    return data;
  }

  // Template tags every BVR template gets. hc_name and hc_email come from
  // the head coach's staff entry, so the staff file is the only one with
  // contact details.
  get globalTags() {
    if (!this.#globalTags) {
      const headCoach = this.settings.headCoach;
      this.#globalTags = { ...this.settings.globalTemplateTags };
      if (headCoach != undefined) {
        this.#globalTags.hc_name = this.staff.contact(headCoach, "name");
        this.#globalTags.hc_email = this.staff.contact(headCoach, "email");
      }
    }
    return this.#globalTags;
  }

  createDraftFromTemplate(settings) {
    const template = new Template(settings);
    template.archive().save().activate();
    return template;
  }

  pinDraft(workingDraft) {
    editor.load(workingDraft);
    editor.pinningEnabled = true;
    this.ui.displayAppMessage("info", "Attendance draft loaded.");
  }

  unpinDraft(workingDraft) {
    editor.load(workingDraft);
    app.stopLiveActivity(workingDraft);
    editor.pinningEnabled = false;
  }

  formatDateYMD(date) {
    const { day, month, year } = this.#deconstructDate(date);

    return `${year}-${month}-${day}`;
  }

  formatDateMDY(date) {
    const { day, month, year } = this.#deconstructDate(date);

    return `${month}-${day}-${year}`;
  }

  cleanUpName(text) {
    const regex = /(?<=\]).*?(?=\(|$)/;

    const textToClean = text.match(regex)[0];
    return textToClean.replace(/\*/g, "").trim();
  }

  getMonth(d = new Date()) {
    const month = d.getMonth() + 1;
    if (month < 10) return `0${month}`;
    return month;
  }

  getDay(d = new Date()) {
    const day = d.getDate();
    if (day < 10) return `0${day}`;
    return day;
  }

  getYear(d = new Date()) {
    return d.getFullYear();
  }

  #deconstructDate(date) {
    return {
      day: this.getDay(date),
      month: this.getMonth(date),
      year: this.getYear(date),
    };
  }

  #loadWorkspace() {
    if (app.currentWorkspace.name == this.workspace) {
      return this.ui.displayAppMessage("info", "Workspace is already loaded.");
    }

    const bvrWorkspace = Workspace.find(this.workspace);
    app.currentWindow.applyWorkspace(bvrWorkspace);
  }
}
