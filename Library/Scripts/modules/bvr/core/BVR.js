if (typeof Team == "undefined") require("modules/bvr/core/Team.js");
if (typeof Game == "undefined") require("modules/bvr/core/Game.js");
if (typeof Sport == "undefined") require("modules/bvr/core/Sport.js");
if (typeof Season == "undefined") require("modules/bvr/core/Season.js");
// if (typeof BVRUtilities == "undefined") require("modules/bvr/utils/BVRUtilities.js");
if (typeof GoogleForm == "undefined") require("modules/bvr/services/GoogleForm.js");
if (typeof Attendance == "undefined") require("modules/bvr/core/Attendance.js");
if (typeof PracticePlan == "undefined") require("modules/bvr/core/PracticePlan.js");
if (typeof TmplSettings == "undefined") require("modules/bvr/utils/TmplSettings.js");
if (typeof Bear == "undefined") require("shared/libraries/bear.js");
if (typeof DraftsUI == "undefined") require("shared/libraries/DraftsUI.js");
if (typeof CloudFS == "undefined") require("modules/cp/filesystems/CloudFS.js");
if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
if (typeof ServiceContainer == "undefined") require("shared/core/ServiceContainer.js");
require("modules/bvr/messages/message_factory.js");

class BVR {
  static settingsFile = "bvr/settings.yaml";
  #settings;
  #ui;
  #services;

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
    const dataFile = this.settings.ppDataFile != undefined
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

  get globalTags() {
    return this.settings.globalTemplateTags;
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
