// ActionHistory.test.js
// Tests for ActionHistory class

require("cp/testing/TestFramework.js");
require("cp/filesystems/CloudFS.js");
require("cp/actions/ActionHistory.js");

function runActionHistoryTests(framework) {
  framework.describe("ActionHistory", () => {
    // Helper to create mock dependencies
    function createMockDependencies() {
      const mockData = { history: [] };

      return {
        fileSystem: {
          read: (file) => {
            return mockData;
          },
          write: (file, data) => {
            mockData.history = data.history;
          },
        },
      };
    }

    framework.it("should initialize with empty history if file doesn't exist", () => {
      const deps = {
        fileSystem: {
          read: () => {
            throw new Error("File not found");
          },
          write: () => {},
        },
      };

      const history = new ActionHistory(deps);
      const results = history.query({});

      Assert.lengthEquals(results, 0, "Should have empty history");
    });

    framework.it("should record action execution", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action = { type: "convert_document", params: { targetType: "sheet" } };

      history.record({
        doc,
        trigger,
        action,
        result: "success",
        details: { newDocID: "XYZ789" },
      });

      const results = history.query({});
      Assert.lengthEquals(results, 1, "Should have one history entry");
      Assert.equal(results[0].docID, "ABC123", "Should record docID");
      Assert.equal(results[0].result, "success", "Should record result");
    });

    framework.it("should record multiple actions", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc1 = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const doc2 = { docID: "DEF456", docIDType: "UlyssesID", destination: "inbox" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action = { type: "log", params: { message: "test" } };

      history.record({ doc: doc1, trigger, action, result: "success" });
      history.record({ doc: doc2, trigger, action, result: "success" });

      const results = history.query({});
      Assert.lengthEquals(results, 2, "Should have two history entries");
    });

    framework.it("should query by docID", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc1 = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const doc2 = { docID: "DEF456", docIDType: "UlyssesID", destination: "inbox" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action = { type: "log", params: { message: "test" } };

      history.record({ doc: doc1, trigger, action, result: "success" });
      history.record({ doc: doc2, trigger, action, result: "success" });

      const results = history.query({ docID: "ABC123" });
      Assert.lengthEquals(results, 1, "Should find one entry");
      Assert.equal(results[0].docID, "ABC123", "Should match docID");
    });

    framework.it("should query by destination", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc1 = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const doc2 = { docID: "DEF456", docIDType: "UlyssesID", destination: "inbox" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action = { type: "log", params: { message: "test" } };

      history.record({ doc: doc1, trigger, action, result: "success" });
      history.record({ doc: doc2, trigger, action, result: "success" });

      const results = history.query({ destination: "inbox" });
      Assert.lengthEquals(results, 1, "Should find one entry");
      Assert.equal(results[0].destination, "inbox", "Should match destination");
    });

    framework.it("should query by trigger type", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const trigger1 = { id: "trigger1", type: "status_change" };
      const trigger2 = { id: "trigger2", type: "time_based" };
      const action = { type: "log", params: { message: "test" } };

      history.record({ doc, trigger: trigger1, action, result: "success" });
      history.record({ doc, trigger: trigger2, action, result: "success" });

      const results = history.query({ triggerType: "status_change" });
      Assert.lengthEquals(results, 1, "Should find one entry");
      Assert.equal(results[0].triggerType, "status_change", "Should match trigger type");
    });

    framework.it("should query by action type", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action1 = { type: "convert_document", params: { targetType: "sheet" } };
      const action2 = { type: "log", params: { message: "test" } };

      history.record({ doc, trigger, action: action1, result: "success" });
      history.record({ doc, trigger, action: action2, result: "success" });

      const results = history.query({ actionType: "log" });
      Assert.lengthEquals(results, 1, "Should find one entry");
      Assert.equal(results[0].action.type, "log", "Should match action type");
    });

    framework.it("should query by result", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action = { type: "log", params: { message: "test" } };

      history.record({ doc, trigger, action, result: "success" });
      history.record({ doc, trigger, action, result: "failure", error: "Test error" });

      const results = history.query({ result: "failure" });
      Assert.lengthEquals(results, 1, "Should find one entry");
      Assert.equal(results[0].result, "failure", "Should match result");
    });

    framework.it("should limit query results", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action = { type: "log", params: { message: "test" } };

      for (let i = 0; i < 10; i++) {
        history.record({ doc, trigger, action, result: "success" });
      }

      const results = history.query({ limit: 5 });
      Assert.lengthEquals(results, 5, "Should limit to 5 entries");
    });

    framework.it("should combine multiple query filters", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc1 = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const doc2 = { docID: "DEF456", docIDType: "UlyssesID", destination: "nr.com" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action = { type: "convert_document", params: { targetType: "sheet" } };

      history.record({ doc: doc1, trigger, action, result: "success" });
      history.record({ doc: doc2, trigger, action, result: "failure" });

      const results = history.query({
        destination: "nr.com",
        result: "success",
      });

      Assert.lengthEquals(results, 1, "Should find one matching entry");
      Assert.equal(results[0].docID, "ABC123", "Should match all filters");
    });

    framework.it("should clear all history", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action = { type: "log", params: { message: "test" } };

      history.record({ doc, trigger, action, result: "success" });
      history.record({ doc, trigger, action, result: "success" });

      history.clear();

      const results = history.query({});
      Assert.lengthEquals(results, 0, "Should have empty history after clear");
    });

    framework.it("should include timestamp in history entries", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action = { type: "log", params: { message: "test" } };

      history.record({ doc, trigger, action, result: "success" });

      const results = history.query({});
      Assert.hasProperty(results[0], "timestamp", "Should have timestamp");
      Assert.isType(results[0].timestamp, "string", "Timestamp should be string");
    });

    framework.it("should record error details for failures", () => {
      const deps = createMockDependencies();
      const history = new ActionHistory(deps);

      const doc = { docID: "ABC123", docIDType: "DraftsID", destination: "nr.com" };
      const trigger = { id: "test-trigger", type: "status_change" };
      const action = { type: "log", params: { message: "test" } };

      history.record({
        doc,
        trigger,
        action,
        result: "failure",
        error: "Something went wrong",
      });

      const results = history.query({});
      Assert.equal(results[0].error, "Something went wrong", "Should record error");
    });
  });
}