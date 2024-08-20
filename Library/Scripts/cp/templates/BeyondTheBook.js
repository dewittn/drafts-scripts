class BeyondTheBook {
  static settingsFile = "cp/templates.yaml";
  #settings;
  #ui;

  constructor() {
    this.#settings = new Settings(this.settingsFile, "beyondTheBook");
    this.#ui = new DraftsUI(this.#settings.uiSettings);

    this.#createDraft();
  }

  get settingsFile() {
    return this.constructor.settingsFile;
  }

  get workspaceName() {
    return this.#settings.workspaceName;
  }

  get nextAction() {
    return this.#settings.nextAction;
  }

  get draftTags() {
    return this.#settings.draftTags;
  }

  get dateFormat() {
    return this.#settings.dateFormat;
  }

  get templateTag() {
    return this.#settings.templateTag;
  }

  get templateFile() {
    return this.#settings.templateFile;
  }

  save() {
    this.draft.update();
    return this;
  }

  activate() {
    if (this.draft == undefined) return;

    // find workspace and load it in drafts list
    const workspace = Workspace.find(this.workspaceName);
    app.applyWorkspace(workspace);

    editor.load(this.draft);
    editor.activate();
    return this;
  }

  addToPipeline() {
    if (this.draft == undefined) return;

    const nextAction = Action.find(this.nextAction);
    app.queueAction(nextAction, this.draft);

    return this;
  }

  #createDraft() {
    this.draft = Draft.create();
    // draftsTags should be formatted as an array like this: ["tag1", "tag2", "tag3"]
    this.draftTags.forEach((tag) => this.draft.addTag(tag));
    this.draft.setTemplateTag(this.templateTag, this.#getTitleFromPrompt());
    this.#processTemplate();
  }

  #getTitleFromPrompt() {
    const { menuSettings } = this.#ui.settings("getTitleFromPrompt");
    const menu = this.#ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    return this.#ui.utilities.getTextFieldValueFromMenu(menu);
  }

  #processTemplate() {
    if (this.templateFile == undefined) return;

    const template = Template.load(this.templateFile);
    this.draft.content = this.draft.processTemplate(template);
  }
}
