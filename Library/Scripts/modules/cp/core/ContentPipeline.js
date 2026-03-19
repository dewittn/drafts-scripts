// Content Pipeline Files
if (typeof DependencyProvider == "undefined") require("modules/cp/core/DependencyProvider.js");
if (typeof Statuses == "undefined") require("modules/cp/core/Statuses.js");
if (typeof Destinations == "undefined") require("modules/cp/core/Destinations.js");
if (typeof RecentRecords == "undefined") require("modules/cp/core/RecentRecords.js");
if (typeof DraftsUI == "undefined") require("shared/libraries/DraftsUI.js");
if (typeof CloudFS == "undefined") require("modules/cp/filesystems/CloudFS.js");
if (typeof NocoController == "undefined") require("modules/cp/databases/NocoDB.js");
if (typeof DocumentFactory == "undefined") require("modules/cp/documents/DocumentFactory.js");
if (typeof TemplateFactory == "undefined") require("modules/cp/templates/template_factory.js");
if (typeof ServiceContainer == "undefined") require("shared/core/ServiceContainer.js");

// Manager classes
if (typeof BaseManager == "undefined") require("modules/cp/managers/BaseManager.js");
if (typeof DocumentManager == "undefined") require("modules/cp/managers/DocumentManager.js");
if (typeof PipelineManager == "undefined") require("modules/cp/managers/PipelineManager.js");
if (typeof StatusManager == "undefined") require("modules/cp/managers/StatusManager.js");
if (typeof MenuOrchestrator == "undefined") require("modules/cp/managers/MenuOrchestrator.js");
if (typeof NavigationManager == "undefined") require("modules/cp/managers/NavigationManager.js");

class ContentPipeline {
  static basePath = "/Library/Data/cp/";
  static settingsFile = "cp/settings.yaml";
  static #instances = new Map(); // One instance per table
  static #constructorWarningShown = false;
  #fs;
  #ui;
  #db;
  #text;
  #recent;
  #statuses;
  #settings;
  #tableName;
  #activeDoc;
  #destinations;
  #document_factory;
  #services;
  #dependencyProvider;

  // Manager instances
  #documentManager;
  #pipelineManager;
  #statusManager;
  #menuOrchestrator;
  #navigationManager;

  /**
   * Get singleton instance of ContentPipeline
   * @param {string} table - Table name (default: "Content")
   * @returns {ContentPipeline} Singleton instance for the table
   */
  static getInstance(table = "Content") {
    if (!ContentPipeline.#instances.has(table)) {
      console.log(
        `[ContentPipeline] Creating singleton instance for table: ${table}`,
      );
      ContentPipeline.#instances.set(table, new ContentPipeline(table));
    } else {
      console.log(
        `[ContentPipeline] Reusing singleton instance for table: ${table}`,
      );
    }
    return ContentPipeline.#instances.get(table);
  }

  /**
   * Reset singleton instances (for testing)
   */
  static resetInstance(table = null) {
    if (table) {
      ContentPipeline.#instances.delete(table);
    } else {
      ContentPipeline.#instances.clear();
    }
  }

  constructor(table = "Content") {
    // Deprecation warning
    if (!ContentPipeline.#constructorWarningShown) {
      console.log(
        "[DEPRECATION] Direct instantiation of ContentPipeline is deprecated. Use ContentPipeline.getInstance() instead.",
      );
      ContentPipeline.#constructorWarningShown = true;
    }

    this.#tableName = table;
    this.#services = ServiceContainer.getInstance();
    this.#activeDoc = null;

    // Register services if not already registered
    this.#registerServices(table);

    // Get defaultTag - handle both string (simple config) and object (multi-table config)
    const settingsDefaultTag = this.settings.defaultTag;
    if (settingsDefaultTag == undefined) {
      throw new Error(
        `[ContentPipeline] defaultTag not found in settings. Run "bun run sync" to generate settings.json.`
      );
    }
    const defaultTag = typeof settingsDefaultTag === 'string'
      ? settingsDefaultTag
      : settingsDefaultTag[this.#tableName];

    // Create dependency provider for lazy dependency injection
    this.#dependencyProvider = new DependencyProvider(
      this,
      this.#tableName,
      defaultTag,
    );

    this.#loadWorkspace();
  }

  #registerServices(table) {
    // Settings
    if (!this.#services.has("cpSettings")) {
      this.#services.register("cpSettings", () => {
        if (typeof Settings == "undefined") {
          require("modules/cp/filesystems/CloudFS.js");
        }
        return new Settings(this.settingsFile);
      }, true);
    }

    // File System
    if (!this.#services.has("cpFileSystem")) {
      this.#services.register("cpFileSystem", () => {
        if (typeof CloudFS == "undefined") {
          require("modules/cp/filesystems/CloudFS.js");
        }
        return new CloudFS(this.basePath);
      }, true);
    }

    // UI
    if (!this.#services.has("cpUI")) {
      this.#services.register("cpUI", (c) => {
        if (typeof DraftsUI == "undefined") {
          require("shared/libraries/DraftsUI.js");
        }
        const settings = c.get("cpSettings");
        return new DraftsUI(settings.ui);
      }, true);
    }

    // Text Utilities
    if (!this.#services.has("textUtilities")) {
      this.#services.register("textUtilities", () => {
        if (typeof TextUtilities == "undefined") {
          require("modules/cp/utils/TextUtilities.js");
        }
        return new TextUtilities();
      }, true);
    }
  }

  // Lazy getters for all dependencies
  get settings() {
    if (!this.#settings) {
      this.#settings = this.#services.get("cpSettings");
    }
    return this.#settings;
  }

  get fs() {
    if (!this.#fs) {
      this.#fs = this.#services.get("cpFileSystem");
    }
    return this.#fs;
  }

  get ui() {
    if (!this.#ui) {
      this.#ui = this.#services.get("cpUI");
    }
    return this.#ui;
  }

  get text() {
    if (!this.#text) {
      this.#text = this.#services.get("textUtilities");
    }
    return this.#text;
  }

  get statuses() {
    if (!this.#statuses) {
      if (typeof Statuses == "undefined") {
        require("modules/cp/core/Statuses.js");
      }
      this.#statuses = new Statuses(this.#dependencyProvider);
    }
    return this.#statuses;
  }

  get destinations() {
    if (!this.#destinations) {
      if (typeof Destinations == "undefined") {
        require("modules/cp/core/Destinations.js");
      }
      this.#destinations = new Destinations(this.#dependencyProvider);
    }
    return this.#destinations;
  }

  get recent() {
    if (!this.#recent) {
      if (typeof RecentRecords == "undefined") {
        require("modules/cp/core/RecentRecords.js");
      }
      this.#recent = new RecentRecords(this.#dependencyProvider);
    }
    return this.#recent;
  }

  get db() {
    if (!this.#db) {
      // Check if a mock database is registered (for testing)
      if (this.#services.has('cpDatabase')) {
        this.#db = this.#services.get('cpDatabase');
      } else {
        // Use real database
        if (typeof NocoController == "undefined") {
          require("modules/cp/databases/NocoDB.js");
        }
        this.#db = new NocoController(this.#dependencyProvider);
      }
    }
    return this.#db;
  }

  get document_factory() {
    if (!this.#document_factory) {
      if (typeof DocumentFactory == "undefined") {
        require("modules/cp/documents/DocumentFactory.js");
      }
      this.#document_factory = new DocumentFactory(this.#dependencyProvider);
    }
    return this.#document_factory;
  }

  // Alias for camelCase convention
  get documentFactory() {
    return this.document_factory;
  }

  // Manager getters - lazy initialization
  get #documents() {
    if (!this.#documentManager) {
      this.#documentManager = new DocumentManager(this.#getManagerContext());
    }
    return this.#documentManager;
  }

  get #pipeline() {
    if (!this.#pipelineManager) {
      this.#pipelineManager = new PipelineManager(this.#getManagerContext());
    }
    return this.#pipelineManager;
  }

  get #status() {
    if (!this.#statusManager) {
      this.#statusManager = new StatusManager(this.#getManagerContext());
    }
    return this.#statusManager;
  }

  get #menus() {
    if (!this.#menuOrchestrator) {
      this.#menuOrchestrator = new MenuOrchestrator(this.#getManagerContext());
    }
    return this.#menuOrchestrator;
  }

  get #navigation() {
    if (!this.#navigationManager) {
      this.#navigationManager = new NavigationManager(
        this.#getManagerContext(),
      );
    }
    return this.#navigationManager;
  }

  // Create manager context object
  #getManagerContext() {
    const pipeline = this;
    return {
      dependencyProvider: this.#dependencyProvider,
      get activeDoc() { return pipeline.#activeDoc; },
      setActiveDoc: (doc) => {
        this.#activeDoc = doc;
      },
      services: this.#services,
      // Provide access to shared dependencies
      database: this.db,
      statuses: this.statuses,
      destinations: this.destinations,
      recentRecords: this.recent,
      documentFactory: this.document_factory,
    };
  }

  // **************
  // * Getter and Setter functions
  // **************
  // Turns on and off debug logging for Ulysses and the database
  set debug(value) {
    if (value == false) return;

    this.db.debug = true;
    this.ui.debug = true;
  }

  get tableName() {
    return this.#tableName;
  }

  get settingsFile() {
    return this.constructor.settingsFile;
  }

  get dirPrefix() {
    return this.settings.dirPrefix;
  }

  get basePath() {
    return this.constructor.basePath;
  }

  get databaseError() {
    return this.db.databaseError;
  }

  get activeDocInPipeline() {
    return this.db.docIsInPipeline(this.#activeDoc);
  }

  get activeDocIsUndefined() {
    return this.#activeDoc == undefined;
  }

  get recentRecordsUpdated() {
    return this.recent.save(this.#activeDoc);
  }

  // **************
  // * Welcome
  // * Startup function
  // **************
  welcome() {
    const nextFunction = this.#menus.showWelcome();
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * openDoc()
  // * Open content in Drafts or Ulysses
  // **************
  openDoc(docID, docIDType) {
    return this.#documents.open(docID, docIDType);
  }

  // **************
  // * useCurrentDraft()
  // * Choses action to run on the active draft
  // **************
  useCurrentDraft() {
    const nextFunction = this.#menus.showCurrentDraftMenu();
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * addContent()
  // *
  // **************
  addContent() {
    const nextFunction = this.#menus.showAddContentMenu();
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * deleteContent()
  // * Removes documents from Recent Records, the database, from an app, or everywhere
  // **************
  deleteContent() {
    return this.#documents.delete();
  }

  // **************
  // * createNewDoc()
  // * Creates a new Document from a template or a black with a destination tag
  // **************
  createNewDoc() {
    this.#activeDoc = this.#documents.create();
    this.addDocToPipeline();
    this.#activeDoc.open();
  }

  // **************
  // * selectDocByStatus()
  // * Pick a post to work with based off a Status
  // **************
  selectDocByStatus() {
    const nextFunction = this.#menus.showDocumentsByStatus();
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * modifyActiveDoc()
  // * Prompts to perform action on this.#activeDoc
  // **************
  modifyActiveDoc(docIDType, docID) {
    const nextFunction = this.#documents.modify(docIDType, docID);
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * addDocToPipeline()
  // * Adds doc to the Productively Pipeline in the database
  // **************
  addDocToPipeline(docIDType, docID = undefined) {
    return this.#pipeline.addDocument(docIDType, docID);
  }

  // **************
  // * addDefaultNotesToSheet()
  // * Adds an existing Ulysses sheet to the pipeline
  // **************
  addDefaultNotesToSheet(targetId) {
    return this.#pipeline.addDefaultNotes(targetId);
  }

  // **************
  // * convertDraft()
  // * Adds draft to Ulysses, Updates Pipeline, and moves draft into trash
  // **************
  convertDraft(uuid = draft.uuid) {
    return this.#pipeline.convertDraft(uuid);
  }

  // **************
  // * updateStatusOfDoc()
  // * Updates the status of a document
  // **************
  updateStatusOfDoc(docID, docIDType) {
    const result = this.#status.updateStatus(docID, docIDType);

    // Handle cross-manager actions
    if (result && typeof result === "object" && result.action) {
      switch (result.action) {
        case "addToPipeline":
          if (this.addDocToPipeline() == false) return;
          // Retry status update
          return this.updateStatusOfDoc(docID, docIDType);

        case "convertDoc":
          this.#pipeline.convertDraft();
          break;

        case "back":
          return this.#functionToRunNext("modifyActiveDoc");
      }
    }

    return result;
  }

  // **************
  // * syncStatusOfSheet()
  // * Updates the status of a sheet based on it's AirTable Record
  // **************
  syncStatusOfSheet(targetId) {
    return this.#status.syncStatusFromDatabase(targetId);
  }

  // **************
  // * getPublishedPostURL()
  // * Returns the URL of a post that has been published
  // **************
  getPublishedPostURL(year = new Date().getFullYear()) {
    const result = this.#navigation.getPublishedPostURL(year);

    // Handle year change request
    if (
      result && typeof result === "object" && result.action === "changeYear"
    ) {
      return this.getPublishedPostURL(result.year);
    }

    return result;
  }

  // **************
  // * Private Functions
  // **************
  #functionToRunNext(name, args) {
    if (name == "canceled" || name == undefined) return context.cancel();

    const route = this.#navigation.routeToFunction(name, args);
    if (route && route.action) {
      return this[route.action].apply(this, route.args || []);
    }
  }

  #throwDBError(parentFunction) {
    this.db.stackTrace["parentFunction"] = parentFunction;
    this.ui.displayAppMessage("error", "Database Error!", this.db.stackTrace);
  }

  #loadWorkspace() {
    const { defaultWorkspace } = this.settings;
    const workspace = Workspace.find(defaultWorkspace);
    app.currentWindow.applyWorkspace(workspace);
  }
}
