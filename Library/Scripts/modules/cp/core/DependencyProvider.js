/**
 * DependencyProvider
 *
 * Provides lazy access to dependencies from ContentPipeline.
 * Instead of capturing a snapshot of dependencies, this allows
 * child classes to access dependencies on-demand, eliminating
 * initialization order issues.
 */
class DependencyProvider {
  #context;
  #tableName;
  #defaultTag;

  constructor(context, tableName, defaultTag) {
    this.#context = context;
    this.#tableName = tableName;
    this.#defaultTag = defaultTag;
  }

  // Core dependencies (always available)
  get ui() {
    return this.#context.ui;
  }

  get fileSystem() {
    return this.#context.fs;
  }

  get settings() {
    return this.#context.settings;
  }

  get textUltilities() {
    return this.#context.text;
  }

  get tableName() {
    return this.#tableName;
  }

  get defaultTag() {
    return this.#defaultTag;
  }

  // Lazy dependencies (initialized on first access)
  get statuses() {
    return this.#context.statuses;
  }

  get destinations() {
    return this.#context.destinations;
  }

  get recentRecords() {
    return this.#context.recent;
  }

  get database() {
    return this.#context.db;
  }
}
