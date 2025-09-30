// ActionRegistry.test.js
// Tests for ActionRegistry class

require("cp/testing/TestFramework.js");
require("cp/actions/ActionRegistry.js");

function runActionRegistryTests(framework) {
  framework.describe("ActionRegistry", () => {
    framework.it("should register a valid action handler", () => {
      const registry = new ActionRegistry({});
      const handler = {
        execute: async (doc, params, context) => {
          return { success: true };
        },
      };

      registry.register("test_action", handler);
      Assert.isTrue(
        registry.has("test_action"),
        "Should have registered action"
      );
    });

    framework.it("should retrieve registered handler", () => {
      const registry = new ActionRegistry({});
      const handler = {
        execute: async (doc, params, context) => {
          return { success: true };
        },
      };

      registry.register("test_action", handler);
      const retrieved = registry.getHandler("test_action");

      Assert.equal(retrieved, handler, "Should retrieve the same handler");
    });

    framework.it("should throw error when registering handler without execute method", () => {
      const registry = new ActionRegistry({});
      const invalidHandler = { run: () => {} };

      Assert.throws(
        () => registry.register("invalid_action", invalidHandler),
        "must have execute() method",
        "Should throw error for invalid handler"
      );
    });

    framework.it("should throw error when registering non-function execute", () => {
      const registry = new ActionRegistry({});
      const invalidHandler = { execute: "not a function" };

      Assert.throws(
        () => registry.register("invalid_action", invalidHandler),
        "must have execute() method",
        "Should throw error for non-function execute"
      );
    });

    framework.it("should return undefined for unregistered action", () => {
      const registry = new ActionRegistry({});

      const handler = registry.getHandler("nonexistent_action");
      Assert.isUndefined(handler, "Should return undefined for unknown action");
    });

    framework.it("should return false for has() on unregistered action", () => {
      const registry = new ActionRegistry({});

      const exists = registry.has("nonexistent_action");
      Assert.isFalse(exists, "Should return false for unknown action");
    });

    framework.it("should list all registered action types", () => {
      const registry = new ActionRegistry({});
      const handler1 = { execute: async () => ({ success: true }) };
      const handler2 = { execute: async () => ({ success: true }) };
      const handler3 = { execute: async () => ({ success: true }) };

      registry.register("action1", handler1);
      registry.register("action2", handler2);
      registry.register("action3", handler3);

      const types = registry.getTypes();
      Assert.lengthEquals(types, 3, "Should have 3 registered types");
      Assert.contains(types, "action1", "Should contain action1");
      Assert.contains(types, "action2", "Should contain action2");
      Assert.contains(types, "action3", "Should contain action3");
    });

    framework.it("should allow overwriting existing action", () => {
      const registry = new ActionRegistry({});
      const handler1 = { execute: async () => ({ result: "first" }) };
      const handler2 = { execute: async () => ({ result: "second" }) };

      registry.register("test_action", handler1);
      registry.register("test_action", handler2);

      const retrieved = registry.getHandler("test_action");
      Assert.equal(
        retrieved,
        handler2,
        "Should retrieve the overwritten handler"
      );
    });

    framework.it("should handle multiple registrations independently", () => {
      const registry = new ActionRegistry({});
      const handler1 = { execute: async () => ({ id: 1 }) };
      const handler2 = { execute: async () => ({ id: 2 }) };

      registry.register("action1", handler1);
      registry.register("action2", handler2);

      const retrieved1 = registry.getHandler("action1");
      const retrieved2 = registry.getHandler("action2");

      Assert.equal(retrieved1, handler1, "Should retrieve correct handler1");
      Assert.equal(retrieved2, handler2, "Should retrieve correct handler2");
      Assert.notEqual(retrieved1, retrieved2, "Handlers should be different");
    });

    framework.it("should accept handlers with async execute methods", () => {
      const registry = new ActionRegistry({});
      const asyncHandler = {
        execute: async (doc, params, context) => {
          return { success: true };
        },
      };

      registry.register("async_action", asyncHandler);
      Assert.isTrue(
        registry.has("async_action"),
        "Should register async handler"
      );
    });

    framework.it("should accept handlers with sync execute methods", () => {
      const registry = new ActionRegistry({});
      const syncHandler = {
        execute: (doc, params, context) => {
          return { success: true };
        },
      };

      registry.register("sync_action", syncHandler);
      Assert.isTrue(
        registry.has("sync_action"),
        "Should register sync handler"
      );
    });
  });
}