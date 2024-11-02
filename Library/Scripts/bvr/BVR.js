require("bvr/Team.js");
require("bvr/Game.js");
require("bvr/Sport.js");
require("bvr/Season.js");
require("bvr/utilities.js");
require("bvr/GoogleForm.js");
require("bvr/GameReport.js");
require("bvr/Attendance.js");
require("bvr/PracticePlan.js");
require("bvr/TmplSettings.js");
require("bvr/messages/message_factory.js");
require("libraries/bear.js");
require("cp/ui/DraftsUI.js");
require("cp/filesystems/CloudFS.js");
require("cp/templates/Template.js");

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
  }

  unpinDraft(workingDraft) {
    app.stopLiveActivity(workingDraft);
    editor.pinningEnabled = false;
    editor.load(workingDraft);
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
