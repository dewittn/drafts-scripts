// ActionRegistry.js
// Manages registration and retrieval of action handlers

class ActionRegistry {
  #handlers;

  constructor(dependancies) {
    this.#handlers = new Map();
  }

  // Register an action handler
  register(actionType, handler) {
    if (!handler.execute || typeof handler.execute !== "function") {
      throw new Error(`Handler for ${actionType} must have execute() method`);
    }

    this.#handlers.set(actionType, handler);
  }

  // Get action handler
  getHandler(actionType) {
    return this.#handlers.get(actionType);
  }

  // Check if action type exists
  has(actionType) {
    return this.#handlers.has(actionType);
  }

  // Get all registered action types
  getTypes() {
    return Array.from(this.#handlers.keys());
  }
}