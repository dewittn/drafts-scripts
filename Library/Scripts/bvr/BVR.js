if (typeof Team == "undefined") require("bvr/Team.js");
if (typeof Game == "undefined") require("bvr/Game.js");
if (typeof Sport == "undefined") require("bvr/Sport.js");
if (typeof Season == "undefined") require("bvr/Season.js");
// if (typeof BVRUtilities == "undefined") require("bvr/BVRUtilities.js");
if (typeof GoogleForm == "undefined") require("bvr/GoogleForm.js");
if (typeof Attendance == "undefined") require("bvr/Attendance.js");
if (typeof PracticePlan == "undefined") require("bvr/PracticePlan.js");
if (typeof TmplSettings == "undefined") require("bvr/TmplSettings.js");
if (typeof Bear == "undefined") require("libraries/bear.js");
if (typeof DraftsUI == "undefined") require("cp/ui/DraftsUI.js");
if (typeof CloudFS == "undefined") require("cp/filesystems/CloudFS.js");
if (typeof Template == "undefined") require("cp/templates/Template.js");
require("bvr/messages/message_factory.js");

class BVR {
  static settingsFile = "bvr/settings.yaml";
  #settings;

  constructor() {
    this.#settings = new Settings(this.settingsFile);
    this.ui = new DraftsUI(this.uiSettings);

    this.ui.debug = true;
    this.#loadWorkspace();
  }

  get settingsFile() {
    return this.constructor.settingsFile;
  }

  get uiSettings() {
    return this.#settings.ui;
  }

  get dirPrefix() {
    return this.#settings.dirPrefix != undefined
      ? this.#settings.dirPrefix
      : "";
  }

  get teamSettingsFile() {
    return `${this.dirPrefix}${this.#settings.teamSettingsFile}`;
  }

  get ppSettingsFile() {
    return `${this.dirPrefix}${this.#settings.ppSettingsFile}`;
  }

  get defaultTemplateFile() {
    return this.#settings.defaultTemplateFile;
  }

  get msgTeamNameTag() {
    return this.#settings.msgTeamNameTag;
  }

  get weekIDTemplateTag() {
    return this.#settings.weekIDTemplateTag;
  }

  get workspace() {
    return this.#settings.workspace;
  }

  get ppDataFile() {
    const dataFile =
      this.#settings.ppDataFile != undefined
        ? `practicePlans.json`
        : this.#settings.ppDataFile;

    return `${this.dirPrefix}${dataFile}`;
  }

  get ppData() {
    if (this.#settings.ppData != undefined) return this.#settings.ppData;

    return new DataFile(this.ppDataFile);
  }

  get coachingDraftID() {
    return this.#settings.coachingDraftID;
  }

  get recordsFile() {
    return `${this.dirPrefix}${this.#settings.recordsFile}`;
  }

  get globalTags() {
    return this.#settings.globalTemplateTags;
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
    const currentWorkspace = app.currentWorkspace;
    if (currentWorkspace.name == this.workspace) return;

    const bvrWorkspace = Workspace.find(this.workspace);
    app.applyWorkspace(bvrWorkspace);
  }
}
