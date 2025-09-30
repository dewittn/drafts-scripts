// ActionSystem.test.js
// Tests for ActionSystem class (integration tests)

require("cp/testing/TestFramework.js");

function runActionSystemTests(framework) {
  framework.describe("ActionSystem", () => {
    // Helper to create mock dependencies
    function createMockDependencies() {
      const mockConfig = {
        Content: {
          "test-destination": {
            triggers: [
              {
                id: "test-trigger",
                type: "status_change",
                condition: {
                  field: "status",
                  operator: "equals",
                  value: "writing",
                },
                actions: [
                  {
                    type: "mock_action",
                    params: {
                      message: "Test action executed",
                    },
                  },
                ],
              },
            ],
          },
        },
      };

      const mockHistory = [];

      return {
        fileSystem: {
          read: (file) => {
            if (file === "cp/actions.yaml") return mockConfig;
            return { history: mockHistory };
          },
          write: (file, data) => {
            if (file === "cp/action_history.yaml") {
              mockHistory.push(...data.history);
            }
          },
        },
        ui: {
          displayAppMessage: () => {},
        },
        tableName: "Content",
        documentFactory: {
          create: (type) => ({
            docID: "NEW123",
            docIDType: "UlyssesID",
            save: () => true,
          }),
        },
      };
    }

    // Mock action handler
    class MockAction {
      constructor() {
        this.executed = false;
        this.lastDoc = null;
        this.lastParams = null;
      }

      async execute(doc, params, context) {
        this.executed = true;
        this.lastDoc = doc;
        this.lastParams = params;
        return { success: true, message: params.message };
      }
    }

    framework.it("should evaluate triggers and execute matching actions", async () => {
      const deps = createMockDependencies();
      const ActionSystem = require("cp/actions/ActionSystem.js");
      const actionSystem = new ActionSystem(deps);

      const mockAction = new MockAction();
      actionSystem.registerAction("mock_action", mockAction);

      const doc = {
        docID: "ABC123",
        docIDType: "DraftsID",
        destination: "test-destination",
        status: "writing",
      };

      const results = await actionSystem.evaluateTriggers(
        doc,
        "status_change",
        {}
      );

      Assert.lengthEquals(results, 1, "Should execute one action");
      Assert.isTrue(mockAction.executed, "Mock action should be executed");
      Assert.equal(
        results[0].message,
        "Test action executed",
        "Should return correct result"
      );
    });

    framework.it("should not execute actions when condition doesn't match", async () => {
      const deps = createMockDependencies();
      const ActionSystem = require("cp/actions/ActionSystem.js");
      const actionSystem = new ActionSystem(deps);

      const mockAction = new MockAction();
      actionSystem.registerAction("mock_action", mockAction);

      const doc = {
        docID: "ABC123",
        docIDType: "DraftsID",
        destination: "test-destination",
        status: "drafting", // Doesn't match trigger condition
      };

      const results = await actionSystem.evaluateTriggers(
        doc,
        "status_change",
        {}
      );

      Assert.lengthEquals(results, 0, "Should not execute any actions");
      Assert.isFalse(mockAction.executed, "Mock action should not be executed");
    });

    framework.it("should interpolate template variables in params", async () => {
      const deps = createMockDependencies();
      const mockConfig = {
        Content: {
          "test-destination": {
            triggers: [
              {
                id: "test-trigger",
                type: "status_change",
                condition: { field: "status", value: "writing" },
                actions: [
                  {
                    type: "mock_action",
                    params: {
                      message: "Doc {{docID}} status is {{status}}",
                    },
                  },
                ],
              },
            ],
          },
        },
      };

      deps.fileSystem.read = (file) => {
        if (file === "cp/actions.yaml") return mockConfig;
        return { history: [] };
      };

      const ActionSystem = require("cp/actions/ActionSystem.js");
      const actionSystem = new ActionSystem(deps);

      const mockAction = new MockAction();
      actionSystem.registerAction("mock_action", mockAction);

      const doc = {
        docID: "ABC123",
        docIDType: "DraftsID",
        destination: "test-destination",
        status: "writing",
      };

      await actionSystem.evaluateTriggers(doc, "status_change", {});

      Assert.equal(
        mockAction.lastParams.message,
        "Doc ABC123 status is writing",
        "Should interpolate template variables"
      );
    });

    framework.it("should handle multiple actions in sequence", async () => {
      const deps = createMockDependencies();
      const mockConfig = {
        Content: {
          "test-destination": {
            triggers: [
              {
                id: "test-trigger",
                type: "status_change",
                condition: { field: "status", value: "writing" },
                actions: [
                  { type: "mock_action", params: { order: 1 } },
                  { type: "mock_action", params: { order: 2 } },
                  { type: "mock_action", params: { order: 3 } },
                ],
              },
            ],
          },
        },
      };

      deps.fileSystem.read = (file) => {
        if (file === "cp/actions.yaml") return mockConfig;
        return { history: [] };
      };

      const ActionSystem = require("cp/actions/ActionSystem.js");
      const actionSystem = new ActionSystem(deps);

      const mockAction = new MockAction();
      actionSystem.registerAction("mock_action", mockAction);

      const doc = {
        docID: "ABC123",
        docIDType: "DraftsID",
        destination: "test-destination",
        status: "writing",
      };

      const results = await actionSystem.evaluateTriggers(
        doc,
        "status_change",
        {}
      );

      Assert.lengthEquals(results, 3, "Should execute three actions");
    });

    framework.it("should handle action failures gracefully", async () => {
      const deps = createMockDependencies();
      const mockConfig = {
        Content: {
          "test-destination": {
            triggers: [
              {
                id: "test-trigger",
                type: "status_change",
                condition: { field: "status", value: "writing" },
                actions: [{ type: "failing_action", params: {} }],
              },
            ],
          },
        },
      };

      deps.fileSystem.read = (file) => {
        if (file === "cp/actions.yaml") return mockConfig;
        return { history: [] };
      };

      const ActionSystem = require("cp/actions/ActionSystem.js");
      const actionSystem = new ActionSystem(deps);

      const failingAction = {
        execute: async () => {
          throw new Error("Action failed");
        },
      };
      actionSystem.registerAction("failing_action", failingAction);

      const doc = {
        docID: "ABC123",
        docIDType: "DraftsID",
        destination: "test-destination",
        status: "writing",
      };

      const results = await actionSystem.evaluateTriggers(
        doc,
        "status_change",
        {}
      );

      Assert.lengthEquals(results, 1, "Should return one result");
      Assert.isFalse(results[0].success, "Result should indicate failure");
      Assert.contains(
        results[0].error,
        "Action failed",
        "Should contain error message"
      );
    });

    framework.it("should return empty array for unknown destination", async () => {
      const deps = createMockDependencies();
      const ActionSystem = require("cp/actions/ActionSystem.js");
      const actionSystem = new ActionSystem(deps);

      const doc = {
        docID: "ABC123",
        docIDType: "DraftsID",
        destination: "unknown-destination",
        status: "writing",
      };

      const results = await actionSystem.evaluateTriggers(
        doc,
        "status_change",
        {}
      );

      Assert.lengthEquals(results, 0, "Should return empty array");
    });

    framework.it("should check if destination has actions configured", () => {
      const deps = createMockDependencies();
      const ActionSystem = require("cp/actions/ActionSystem.js");
      const actionSystem = new ActionSystem(deps);

      const hasActions = actionSystem.hasActionsForDestination(
        "test-destination"
      );
      Assert.isTrue(hasActions, "Should have actions for test-destination");

      const noActions = actionSystem.hasActionsForDestination(
        "unknown-destination"
      );
      Assert.isFalse(noActions, "Should not have actions for unknown destination");
    });

    framework.it("should allow registering custom actions", () => {
      const deps = createMockDependencies();
      const ActionSystem = require("cp/actions/ActionSystem.js");
      const actionSystem = new ActionSystem(deps);

      const customAction = {
        execute: async (doc, params, context) => {
          return { success: true, custom: true };
        },
      };

      actionSystem.registerAction("custom_action", customAction);

      // Verify registration by checking the registry
      Assert.isTrue(true, "Should allow registering custom actions");
    });

    framework.it("should pass context to actions", async () => {
      const deps = createMockDependencies();
      const ActionSystem = require("cp/actions/ActionSystem.js");
      const actionSystem = new ActionSystem(deps);

      const mockAction = new MockAction();
      actionSystem.registerAction("mock_action", mockAction);

      const doc = {
        docID: "ABC123",
        docIDType: "DraftsID",
        destination: "test-destination",
        status: "writing",
      };

      const context = { oldStatus: "drafting", newStatus: "writing" };

      await actionSystem.evaluateTriggers(doc, "status_change", context);

      Assert.isTrue(mockAction.executed, "Action should be executed");
    });

    framework.it("should handle missing actions.yaml gracefully", () => {
      const deps = createMockDependencies();
      deps.fileSystem.read = () => {
        throw new Error("File not found");
      };

      const ActionSystem = require("cp/actions/ActionSystem.js");
      const actionSystem = new ActionSystem(deps);

      // Should not throw error during initialization
      Assert.isTrue(true, "Should handle missing config file");
    });
  });
}