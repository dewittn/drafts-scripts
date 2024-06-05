class AuthorUpdate {
  static settingsFile = "cp/templates.yaml";
  #settings;
  #ui;

  constructor() {
    this.#settings = new Settings(this.settingsFile, "authorUpdate");
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

  #getMonthFromPrompt() {
    const { menuSettings } = this.#ui.settings("getMonthFromPrompt");
    const months = this.#getMonths();
    months.forEach((month) => menuSettings.menuItems.push({ type: "button", data: { name: month } }));

    const monthPrompt = this.#ui.buildMenu(menuSettings);
    if (monthPrompt.show() == false) return context.cancel();

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

  #createDraft() {
    this.draft = Draft.create();
    // draftsTags should be formatted as an array like this: ["tag1", "tag2", "tag3"]
    this.draftTags.forEach((tag) => this.draft.addTag(tag));
    this.draft.setTemplateTag(this.templateTag, this.#getMonthFromPrompt());
    this.#processTemplate();
  }

  #processTemplate() {
    if (this.templateFile == undefined) return;

    const template = Template.load(this.templateFile);
    this.draft.content = this.draft.processTemplate(template);
  }
}
