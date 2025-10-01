/**
 * SimpleDependencyProvider
 *
 * A simple dependency provider that works with factory functions.
 * Used by ServiceContainer-based code for lazy dependency injection.
 */
class SimpleDependencyProvider {
  #factories;

  constructor(factories) {
    this.#factories = factories;
  }

  get ui() {
    return typeof this.#factories.ui === 'function'
      ? this.#factories.ui()
      : this.#factories.ui;
  }

  get fileSystem() {
    return typeof this.#factories.fileSystem === 'function'
      ? this.#factories.fileSystem()
      : this.#factories.fileSystem;
  }

  get settings() {
    return typeof this.#factories.settings === 'function'
      ? this.#factories.settings()
      : this.#factories.settings;
  }

  get textUltilities() {
    return typeof this.#factories.textUltilities === 'function'
      ? this.#factories.textUltilities()
      : this.#factories.textUltilities;
  }

  get tableName() {
    return typeof this.#factories.tableName === 'function'
      ? this.#factories.tableName()
      : this.#factories.tableName;
  }

  get defaultTag() {
    return typeof this.#factories.defaultTag === 'function'
      ? this.#factories.defaultTag()
      : this.#factories.defaultTag;
  }

  get statuses() {
    return typeof this.#factories.statuses === 'function'
      ? this.#factories.statuses()
      : this.#factories.statuses;
  }

  get destinations() {
    return typeof this.#factories.destinations === 'function'
      ? this.#factories.destinations()
      : this.#factories.destinations;
  }

  get recentRecords() {
    return typeof this.#factories.recentRecords === 'function'
      ? this.#factories.recentRecords()
      : this.#factories.recentRecords;
  }

  get database() {
    return typeof this.#factories.database === 'function'
      ? this.#factories.database()
      : this.#factories.database;
  }
}
