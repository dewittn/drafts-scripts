/**
 * ServiceContainer - A singleton dependency injection container
 *
 * Provides lazy instantiation and singleton pattern for services.
 * Manages the dependency graph and supports configuration injection.
 *
 * Usage:
 *   const services = ServiceContainer.getInstance();
 *   services.register('fileSystem', () => new CloudFS('/path'));
 *   const fs = services.get('fileSystem');
 */
class ServiceContainer {
  static #instance = null;
  #services = new Map();
  #singletons = new Map();
  #factories = new Map();

  constructor() {
    if (ServiceContainer.#instance) {
      return ServiceContainer.#instance;
    }
    ServiceContainer.#instance = this;
  }

  /**
   * Get the singleton instance of ServiceContainer
   */
  static getInstance() {
    if (!ServiceContainer.#instance) {
      ServiceContainer.#instance = new ServiceContainer();
    }
    return ServiceContainer.#instance;
  }

  /**
   * Register a service with a factory function
   * @param {string} name - Service name
   * @param {Function} factory - Factory function that creates the service
   * @param {boolean} singleton - Whether to cache the instance (default: true)
   */
  register(name, factory, singleton = true) {
    if (typeof factory !== 'function') {
      throw new Error(`Factory for service '${name}' must be a function`);
    }

    this.#factories.set(name, { factory, singleton });

    // Clear any cached instance if re-registering
    if (this.#singletons.has(name)) {
      this.#singletons.delete(name);
    }
  }

  /**
   * Register an existing instance as a singleton
   * @param {string} name - Service name
   * @param {*} instance - Service instance
   */
  registerInstance(name, instance) {
    this.#singletons.set(name, instance);
    this.#factories.set(name, { factory: () => instance, singleton: true });
  }

  /**
   * Get a service by name (lazy instantiation)
   * @param {string} name - Service name
   * @returns {*} Service instance
   */
  get(name) {
    // Check if singleton instance exists
    if (this.#singletons.has(name)) {
      return this.#singletons.get(name);
    }

    // Check if factory exists
    if (!this.#factories.has(name)) {
      throw new Error(`Service '${name}' is not registered`);
    }

    const { factory, singleton } = this.#factories.get(name);
    const instance = factory(this);

    // Cache if singleton
    if (singleton) {
      this.#singletons.set(name, instance);
    }

    return instance;
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean}
   */
  has(name) {
    return this.#factories.has(name);
  }

  /**
   * Remove a service registration
   * @param {string} name - Service name
   */
  unregister(name) {
    this.#factories.delete(name);
    this.#singletons.delete(name);
  }

  /**
   * Reset all services (useful for testing)
   */
  reset() {
    this.#services.clear();
    this.#singletons.clear();
    this.#factories.clear();
  }

  /**
   * Reset only singleton instances (keeps factory registrations)
   */
  resetSingletons() {
    this.#singletons.clear();
  }

  /**
   * Get all registered service names
   * @returns {string[]}
   */
  getRegisteredServices() {
    return Array.from(this.#factories.keys());
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ServiceContainer;
}