// ActionSystem.js
// Core action system that orchestrates triggers and actions

require("cp/actions/ActionRegistry.js");
require("cp/actions/TriggerEvaluator.js");
require("cp/actions/ActionHistory.js");
require("cp/actions/handlers/ConvertDocumentAction.js");
require("cp/actions/handlers/NotificationAction.js");
require("cp/actions/handlers/WebhookAction.js");
require("cp/actions/handlers/LogAction.js");
require("cp/actions/handlers/ArchiveDocumentAction.js");

class ActionSystem {
  #fs;
  #ui;
  #config;
  #table;
  #history;
  #actionRegistry;
  #triggerEvaluator;
  #documentFactory;

  constructor(dependancies) {
    this.#fs = dependancies.fileSystem;
    this.#ui = dependancies.ui;
    this.#table = dependancies.tableName;
    this.#documentFactory = dependancies.documentFactory;

    // Load configuration
    try {
      this.#config = this.#fs.read("cp/actions.yaml");
    } catch (error) {
      console.warn("Could not load actions.yaml, action system disabled");
      this.#config = {};
    }

    // Initialize action registry and trigger evaluator
    this.#history = new ActionHistory(dependancies);
    this.#actionRegistry = new ActionRegistry(dependancies);
    this.#triggerEvaluator = new TriggerEvaluator();

    // Register default actions
    this.#registerDefaultActions();
  }

  // Evaluate triggers and execute actions
  async evaluateTriggers(doc, triggerType, context = {}) {
    const destination = doc.destination;
    const triggers = this.#getTriggersForDestination(destination);

    if (!triggers) return [];

    const matchedTriggers = triggers.filter(
      (trigger) =>
        trigger.type === triggerType &&
        this.#triggerEvaluator.evaluate(trigger, doc, context)
    );

    const results = [];
    for (const trigger of matchedTriggers) {
      const triggerResults = await this.#executeTriggerActions(
        trigger,
        doc,
        context
      );
      results.push(...triggerResults);
    }

    return results;
  }

  // Execute all actions for a trigger
  async #executeTriggerActions(trigger, doc, context) {
    const results = [];

    for (const actionConfig of trigger.actions) {
      try {
        const result = await this.#executeAction(actionConfig, doc, context);

        results.push(result);

        // Log to history
        this.#history.record({
          doc,
          trigger,
          action: actionConfig,
          result: "success",
          details: result,
        });
      } catch (error) {
        console.error(`Action failed: ${error.message}`);

        results.push({
          success: false,
          error: error.message,
        });

        // Log failure to history
        this.#history.record({
          doc,
          trigger,
          action: actionConfig,
          result: "failure",
          error: error.message,
        });
      }
    }

    return results;
  }

  // Execute a single action
  async #executeAction(actionConfig, doc, context) {
    const actionHandler = this.#actionRegistry.getHandler(actionConfig.type);

    if (!actionHandler) {
      throw new Error(`Unknown action type: ${actionConfig.type}`);
    }

    // Interpolate template variables in params
    const interpolatedParams = this.#interpolateParams(
      actionConfig.params,
      doc,
      context
    );

    // Execute action
    return await actionHandler.execute(doc, interpolatedParams, context);
  }

  // Get triggers for a destination
  #getTriggersForDestination(destination) {
    return this.#config[this.#table]?.[destination]?.triggers;
  }

  // Interpolate {{variable}} syntax in params
  #interpolateParams(params, doc, context) {
    const data = { ...doc, ...context };
    const json = JSON.stringify(params);

    const interpolated = json.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] ?? match;
    });

    return JSON.parse(interpolated);
  }

  // Register default action handlers
  #registerDefaultActions() {
    this.#actionRegistry.register(
      "convert_document",
      new ConvertDocumentAction({ documentFactory: this.#documentFactory })
    );
    this.#actionRegistry.register(
      "notification",
      new NotificationAction({ ui: this.#ui })
    );
    this.#actionRegistry.register("webhook", new WebhookAction());
    this.#actionRegistry.register("log", new LogAction());
    this.#actionRegistry.register(
      "archive_document",
      new ArchiveDocumentAction({ fileSystem: this.#fs })
    );
  }

  // Register custom action handler
  registerAction(actionType, handler) {
    this.#actionRegistry.register(actionType, handler);
  }

  // Query action history
  getHistory(filters = {}) {
    return this.#history.query(filters);
  }

  // Check if actions are configured for a destination
  hasActionsForDestination(destination) {
    const triggers = this.#getTriggersForDestination(destination);
    return triggers && triggers.length > 0;
  }
}