/**
 * BaseManager - Base class for all ContentPipeline managers
 * Provides common functionality and shared dependencies
 */
class BaseManager {
  #context;
  #dependencyProvider;

  constructor(context) {
    this.#context = context;
    this.#dependencyProvider = context.dependencyProvider;
  }

  // Shared getters for common dependencies
  get ui() {
    return this.#dependencyProvider.ui;
  }

  get settings() {
    return this.#dependencyProvider.settings;
  }

  get db() {
    return this.#context.database;
  }

  get fs() {
    return this.#dependencyProvider.fileSystem;
  }

  get text() {
    return this.#dependencyProvider.textUltilities;
  }

  get statuses() {
    return this.#context.statuses;
  }

  get destinations() {
    return this.#context.destinations;
  }

  get recent() {
    return this.#context.recentRecords;
  }

  get documentFactory() {
    return this.#context.documentFactory;
  }

  // Shared active document access
  get activeDoc() {
    return this.#context.activeDoc;
  }

  set activeDoc(doc) {
    this.#context.setActiveDoc(doc);
  }

  // Shared utility methods
  displayAppMessage(type, message, data = {}) {
    return this.ui.displayAppMessage(type, message, data);
  }

  throwDBError(parentFunction) {
    this.db.stackTrace["parentFunction"] = parentFunction;
    this.ui.displayAppMessage("error", "Database Error!", this.db.stackTrace);
  }
}
