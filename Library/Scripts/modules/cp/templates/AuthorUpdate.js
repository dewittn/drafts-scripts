if (typeof Template == "undefined") require("../templates/Template.js");
if (typeof Settings == "undefined") require("../filesystems/CloudFS.js");
if (typeof DraftsUI == "undefined") require("../../../shared/libraries/DraftsUI.js");

class AuthorUpdate {
  static settingsFile = "cp/templates.yaml";
  #settings;
  #ui;

  constructor() {
    this.#settings = new Settings(this.settingsFile, "authorUpdate");
    this.#ui = new DraftsUI(this.#settings.uiSettings);

    this.#createTemplate();
  }

  get draft() {
    return this.template.draft;
  }

  get settingsFile() {
    return this.constructor.settingsFile;
  }

  get templateSettings() {
    return this.#settings.templateSettings;
  }

  get dateFormat() {
    return this.#settings.dateFormat;
  }

  get templateTag() {
    return this.#settings?.templateSettings?.templateTag;
  }

  save() {
    if (this.template != undefined) this.template.activate();
    return this;
  }

  activate() {
    if (this.template != undefined) this.template.activate();
    return this;
  }

  addToPipeline() {
    if (this.template != undefined) this.template.queueNextAction();
    return this;
  }

  #createTemplate() {
    const templateTags = {};
    const updateMonth = this.#getMonthFromPrompt();
    if (updateMonth == undefined) return context.cancel();

    templateTags[this.templateTag] = updateMonth;
    const settings = {
      templateTags: templateTags,
      ...this.templateSettings,
    };

    this.template = new Template(settings);
  }

  #getMonthFromPrompt() {
    const { menuSettings } = this.#ui.settings("getMonthFromPrompt");
    const months = this.#getMonths();
    months.forEach((month) =>
      menuSettings.menuItems.push({ type: "button", data: { name: month } })
    );

    const monthPrompt = this.#ui.buildMenu(menuSettings);
    if (monthPrompt.show() == false) return undefined;

    return monthPrompt.buttonPressed;
  }

  #getMonths() {
    // Get names of current and next month
    const date = new Date();
    const currentMonth = date.format(this.dateFormat);

    date.setDate(32);
    const nextMonth = date.format(this.dateFormat);

    return [nextMonth, currentMonth];
  }
}
