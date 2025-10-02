if (typeof CloudFS == "undefined") require("../filesystems/CloudFS.js");
class Template {
  static basePath = "/Library/Templates";
  #fs;
  #settings;

  constructor(settings) {
    this.#fs = new CloudFS(this.basePath);
    this.#settings = settings;

    this.#createDraft();
  }

  static load(fileName) {
    const fs = new CloudFS(this.basePath);
    return fs.read(fileName);
  }

  get basePath() {
    return this.constructor.basePath;
  }

  get draftID() {
    if (this.draft == undefined) return "";
    return this.draft.uuid;
  }

  get displayTitle() {
    if (this.draft == undefined) return "";
    return this.draft.displayTitle;
  }

  get content() {
    if (this.draft == undefined) return "";
    return this.draft.content;
  }

  get draftTags() {
    if (this.#settings.draftTags == undefined) return [];
    return this.#settings.draftTags;
  }

  get nextAction() {
    return this.#settings.nextAction;
  }

  get templateFile() {
    return this.#settings.templateFile;
  }

  get templateText() {
    return this.#settings.templateText;
  }

  get templateTags() {
    if (this.#settings.templateTags == undefined) return [];
    return Object.entries(this.#settings.templateTags);
  }

  get mustacheTags() {
    if (this.#settings.templateTags == undefined) return {};
    return this.#settings.templateTags;
  }

  get workspaceName() {
    return this.#settings.workspaceName;
  }

  save() {
    this.draft.update();
    return this;
  }

  archive() {
    this.draft.isArchived = true;
    return this;
  }

  activate() {
    if (this.draft == undefined) return;

    // find workspace and load it in drafts list
    if (this.workspaceName && app.currentWorkspace.name != this.workspaceName) {
      const workspace = Workspace.find(this.workspaceName);
      app.currentWindow.applyWorkspace(workspace);
    }

    editor.load(this.draft);
    editor.activate();
    return this;
  }

  queueNextAction() {
    if (this.draft == undefined) return;

    const nextAction = Action.find(this.nextAction);
    app.queueAction(nextAction, this.draft);

    return this;
  }

  #createDraft() {
    this.draft = Draft.create();
    // draftsTags should be formatted as an array like this: ["tag1", "tag2", "tag3"]
    this.draftTags.forEach((tag) => this.draft.addTag(tag));
    this.templateTags.forEach(([key, value]) =>
      this.draft.setTemplateTag(key, value)
    );

    this.#processTemplate();
  }

  #processTemplate() {
    if (this.templateFile == undefined) return;

    const template = this.#fs.read(this.templateFile);

    if (this.templateFile.endsWith(".md")) {
      this.draft.content = this.draft.processTemplate(template);
    }

    if (this.templateFile.endsWith(".mustache")) {
      this.draft.content = this.draft.processMustacheTemplate(
        "text",
        template,
        this.mustacheTags,
      );
    }
  }
}
