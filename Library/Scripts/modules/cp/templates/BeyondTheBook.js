if (typeof Template == "undefined") require("../templates/Template.js");
if (typeof Settings == "undefined") require("../filesystems/CloudFS.js");
if (typeof DraftsUI == "undefined") require("../../../shared/libraries/DraftsUI.js");

class BeyondTheBook {
  static settingsFile = "cp/templates.yaml";
  #settings;
  #ui;

  constructor() {
    this.#settings = new Settings(this.settingsFile, "beyondTheBook");
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

  get templateTag() {
    return this.#settings?.templateSettings?.templateTag;
  }

  save() {
    this.template.activate();
    return this;
  }

  activate() {
    this.template.activate();
    return this;
  }

  addToPipeline() {
    this.template.queueNextAction();
    return this;
  }

  #createTemplate() {
    const templateTags = {};
    templateTags[this.templateTag] = this.#getTitleFromPrompt();
    const settings = {
      templateTags: templateTags,
      ...this.templateSettings,
    };

    this.template = new Template(settings);
  }

  #getTitleFromPrompt() {
    const { menuSettings } = this.#ui.settings("getTitleFromPrompt");
    const menu = this.#ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    return this.#ui.utilities.getTextFieldValueFromMenu(menu);
  }
}
