// TriggerEvaluator.test.js
// Tests for TriggerEvaluator class

require("cp/testing/TestFramework.js");
require("cp/actions/TriggerEvaluator.js");

function runTriggerEvaluatorTests(framework) {
  const evaluator = new TriggerEvaluator();

  framework.describe("TriggerEvaluator", () => {
    // Equals operator tests
    framework.it("should evaluate equals operator with matching values", () => {
      const trigger = {
        condition: {
          field: "status",
          operator: "equals",
          value: "writing",
        },
      };
      const doc = { status: "writing" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isTrue(result, "Should return true for matching values");
    });

    framework.it("should evaluate equals operator with non-matching values", () => {
      const trigger = {
        condition: {
          field: "status",
          operator: "equals",
          value: "writing",
        },
      };
      const doc = { status: "drafting" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isFalse(result, "Should return false for non-matching values");
    });

    framework.it("should be case-insensitive for equals operator", () => {
      const trigger = {
        condition: {
          field: "status",
          operator: "equals",
          value: "WRITING",
        },
      };
      const doc = { status: "writing" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isTrue(result, "Should be case-insensitive");
    });

    // Not equals operator tests
    framework.it("should evaluate not_equals operator correctly", () => {
      const trigger = {
        condition: {
          field: "status",
          operator: "not_equals",
          value: "writing",
        },
      };
      const doc = { status: "drafting" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isTrue(result, "Should return true for non-matching values");
    });

    framework.it("should evaluate not_equals with matching values", () => {
      const trigger = {
        condition: {
          field: "status",
          operator: "not_equals",
          value: "writing",
        },
      };
      const doc = { status: "writing" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isFalse(result, "Should return false for matching values");
    });

    // Matches operator tests
    framework.it("should evaluate matches operator with regex", () => {
      const trigger = {
        condition: {
          field: "status",
          operator: "matches",
          value: "Published.*",
        },
      };
      const doc = { status: "Published 2025" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isTrue(result, "Should match regex pattern");
    });

    framework.it("should evaluate matches with non-matching pattern", () => {
      const trigger = {
        condition: {
          field: "status",
          operator: "matches",
          value: "Published.*",
        },
      };
      const doc = { status: "Drafting" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isFalse(result, "Should not match non-matching pattern");
    });

    // Contains operator tests
    framework.it("should evaluate contains operator", () => {
      const trigger = {
        condition: {
          field: "title",
          operator: "contains",
          value: "Test",
        },
      };
      const doc = { title: "This is a Test Document" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isTrue(result, "Should find substring in string");
    });

    framework.it("should evaluate contains with missing substring", () => {
      const trigger = {
        condition: {
          field: "title",
          operator: "contains",
          value: "Missing",
        },
      };
      const doc = { title: "This is a Test Document" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isFalse(result, "Should not find missing substring");
    });

    // Older than operator tests
    framework.it("should evaluate older_than with old date", () => {
      const trigger = {
        condition: {
          field: "lastModified",
          operator: "older_than",
          value: "1d",
        },
      };
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
      const doc = { lastModified: twoDaysAgo };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isTrue(result, "Should return true for date older than 1 day");
    });

    framework.it("should evaluate older_than with recent date", () => {
      const trigger = {
        condition: {
          field: "lastModified",
          operator: "older_than",
          value: "30d",
        },
      };
      const today = new Date().toISOString();
      const doc = { lastModified: today };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isFalse(result, "Should return false for recent date");
    });

    // Default operator tests
    framework.it("should default to equals when no operator specified", () => {
      const trigger = {
        condition: {
          field: "status",
          value: "writing",
        },
      };
      const doc = { status: "writing" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isTrue(result, "Should default to equals operator");
    });

    // Context tests
    framework.it("should evaluate fields from context", () => {
      const trigger = {
        condition: {
          field: "newStatus",
          operator: "equals",
          value: "writing",
        },
      };
      const doc = { status: "drafting" };
      const context = { newStatus: "writing" };

      const result = evaluator.evaluate(trigger, doc, context);
      Assert.isTrue(result, "Should access context fields");
    });

    framework.it("should prioritize doc fields over context fields", () => {
      const trigger = {
        condition: {
          field: "status",
          operator: "equals",
          value: "writing",
        },
      };
      const doc = { status: "writing" };
      const context = { status: "drafting" };

      const result = evaluator.evaluate(trigger, doc, context);
      Assert.isTrue(result, "Should use doc field over context field");
    });

    // No condition tests
    framework.it("should return true when no condition specified", () => {
      const trigger = {};
      const doc = { status: "writing" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isTrue(result, "Should return true with no condition");
    });

    // Unknown operator tests
    framework.it("should return false for unknown operator", () => {
      const trigger = {
        condition: {
          field: "status",
          operator: "unknown_operator",
          value: "writing",
        },
      };
      const doc = { status: "writing" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isFalse(result, "Should return false for unknown operator");
    });

    // Undefined field tests
    framework.it("should handle undefined field values", () => {
      const trigger = {
        condition: {
          field: "nonExistentField",
          operator: "equals",
          value: "test",
        },
      };
      const doc = { status: "writing" };

      const result = evaluator.evaluate(trigger, doc, {});
      Assert.isFalse(result, "Should return false for undefined fields");
    });
  });
}