// ActionHandlers.test.js
// Tests for action handler classes

require("cp/testing/TestFramework.js");
require("cp/actions/handlers/LogAction.js");
require("cp/actions/handlers/NotificationAction.js");

function runActionHandlerTests(framework) {
  framework.describe("LogAction", () => {
    framework.it("should execute log action with message", async () => {
      const handler = new LogAction();
      const doc = { docID: "ABC123", status: "writing" };
      const params = { message: "Test log message" };

      const result = await handler.execute(doc, params, {});

      Assert.isTrue(result.success, "Should return success");
      Assert.equal(result.message, "Test log message", "Should return message");
      Assert.equal(result.level, "info", "Should default to info level");
    });

    framework.it("should execute log action with custom level", async () => {
      const handler = new LogAction();
      const doc = { docID: "ABC123", status: "writing" };
      const params = { message: "Warning message", level: "warning" };

      const result = await handler.execute(doc, params, {});

      Assert.isTrue(result.success, "Should return success");
      Assert.equal(result.level, "warning", "Should use custom level");
    });

    framework.it("should throw error when message param is missing", async () => {
      const handler = new LogAction();
      const doc = { docID: "ABC123", status: "writing" };
      const params = {};

      await Assert.throwsAsync(
        async () => await handler.execute(doc, params, {}),
        "message parameter is required",
        "Should throw error for missing message"
      );
    });

    framework.it("should include timestamp in result", async () => {
      const handler = new LogAction();
      const doc = { docID: "ABC123", status: "writing" };
      const params = { message: "Test message" };

      const result = await handler.execute(doc, params, {});

      Assert.hasProperty(result, "timestamp", "Should include timestamp");
      Assert.isType(result.timestamp, "string", "Timestamp should be string");
    });
  });

  framework.describe("NotificationAction", () => {
    framework.it("should execute notification with title and message", async () => {
      const mockUI = {
        displayAppMessage: (level, title, options) => {
          return { level, title, message: options.message };
        },
      };

      const handler = new NotificationAction({ ui: mockUI });
      const doc = { docID: "ABC123", status: "writing" };
      const params = {
        title: "Test Title",
        message: "Test Message",
      };

      const result = await handler.execute(doc, params, {});

      Assert.isTrue(result.success, "Should return success");
      Assert.equal(result.title, "Test Title", "Should return title");
      Assert.equal(result.message, "Test Message", "Should return message");
      Assert.equal(result.level, "info", "Should default to info level");
    });

    framework.it("should execute notification with custom level", async () => {
      const mockUI = {
        displayAppMessage: (level, title, options) => {
          return { level, title, message: options.message };
        },
      };

      const handler = new NotificationAction({ ui: mockUI });
      const doc = { docID: "ABC123", status: "writing" };
      const params = {
        title: "Success",
        message: "Operation completed",
        level: "success",
      };

      const result = await handler.execute(doc, params, {});

      Assert.equal(result.level, "success", "Should use custom level");
    });

    framework.it("should throw error when title param is missing", async () => {
      const mockUI = { displayAppMessage: () => {} };
      const handler = new NotificationAction({ ui: mockUI });
      const doc = { docID: "ABC123", status: "writing" };
      const params = { message: "Test Message" };

      await Assert.throwsAsync(
        async () => await handler.execute(doc, params, {}),
        "title and message parameters are required",
        "Should throw error for missing title"
      );
    });

    framework.it("should throw error when message param is missing", async () => {
      const mockUI = { displayAppMessage: () => {} };
      const handler = new NotificationAction({ ui: mockUI });
      const doc = { docID: "ABC123", status: "writing" };
      const params = { title: "Test Title" };

      await Assert.throwsAsync(
        async () => await handler.execute(doc, params, {}),
        "title and message parameters are required",
        "Should throw error for missing message"
      );
    });
  });

  framework.describe("ConvertDocumentAction", () => {
    framework.it("should throw error when targetType param is missing", async () => {
      const mockDocFactory = { create: () => null };
      const ConvertDocumentAction = require("cp/actions/handlers/ConvertDocumentAction.js");
      const handler = new ConvertDocumentAction({
        documentFactory: mockDocFactory,
      });

      const doc = { docID: "ABC123", status: "writing" };
      const params = {};

      await Assert.throwsAsync(
        async () => await handler.execute(doc, params, {}),
        "targetType parameter is required",
        "Should throw error for missing targetType"
      );
    });

    framework.it("should throw error when document creation fails", async () => {
      const mockDocFactory = { create: () => null };
      const ConvertDocumentAction = require("cp/actions/handlers/ConvertDocumentAction.js");
      const handler = new ConvertDocumentAction({
        documentFactory: mockDocFactory,
      });

      const doc = { docID: "ABC123", status: "writing" };
      const params = { targetType: "sheet" };

      await Assert.throwsAsync(
        async () => await handler.execute(doc, params, {}),
        "Could not create document",
        "Should throw error when creation fails"
      );
    });

    framework.it("should convert document successfully", async () => {
      const mockNewDoc = {
        docID: "XYZ789",
        docIDType: "UlyssesID",
        save: () => true,
      };

      const mockDocFactory = {
        create: (type) => {
          return mockNewDoc;
        },
      };

      const ConvertDocumentAction = require("cp/actions/handlers/ConvertDocumentAction.js");
      const handler = new ConvertDocumentAction({
        documentFactory: mockDocFactory,
      });

      const doc = {
        docID: "ABC123",
        docIDType: "DraftsID",
        status: "writing",
        destination: "nr.com",
        content: "Test content",
      };
      const params = { targetType: "sheet" };

      const result = await handler.execute(doc, params, {});

      Assert.isTrue(result.success, "Should return success");
      Assert.equal(result.newDocID, "XYZ789", "Should return new doc ID");
      Assert.equal(
        result.newDocIDType,
        "UlyssesID",
        "Should return new doc type"
      );
      Assert.equal(result.oldDocID, "ABC123", "Should return old doc ID");
    });

    framework.it("should copy document properties to new document", async () => {
      let copiedDoc = null;

      const mockNewDoc = {
        docID: "XYZ789",
        docIDType: "UlyssesID",
        save: () => true,
      };

      const mockDocFactory = {
        create: (type) => {
          copiedDoc = mockNewDoc;
          return mockNewDoc;
        },
      };

      const ConvertDocumentAction = require("cp/actions/handlers/ConvertDocumentAction.js");
      const handler = new ConvertDocumentAction({
        documentFactory: mockDocFactory,
      });

      const doc = {
        docID: "ABC123",
        docIDType: "DraftsID",
        status: "writing",
        destination: "nr.com",
        content: "Test content",
        record: { id: "REC123" },
      };
      const params = { targetType: "sheet" };

      await handler.execute(doc, params, {});

      Assert.equal(copiedDoc.status, "writing", "Should copy status");
      Assert.equal(copiedDoc.destination, "nr.com", "Should copy destination");
      Assert.equal(copiedDoc.content, "Test content", "Should copy content");
      Assert.deepEqual(
        copiedDoc.record,
        { id: "REC123" },
        "Should copy record"
      );
    });
  });

  framework.describe("ArchiveDocumentAction", () => {
    framework.it("should throw error when location param is missing", async () => {
      const ArchiveDocumentAction = require("cp/actions/handlers/ArchiveDocumentAction.js");
      const handler = new ArchiveDocumentAction({ fileSystem: {} });

      const doc = { docID: "ABC123", status: "writing" };
      const params = {};

      await Assert.throwsAsync(
        async () => await handler.execute(doc, params, {}),
        "location parameter is required",
        "Should throw error for missing location"
      );
    });

    framework.it("should archive document with archive method", async () => {
      let archived = false;

      const ArchiveDocumentAction = require("cp/actions/handlers/ArchiveDocumentAction.js");
      const handler = new ArchiveDocumentAction({ fileSystem: {} });

      const doc = {
        docID: "ABC123",
        docIDType: "DraftsID",
        status: "writing",
        archive: () => {
          archived = true;
        },
      };
      const params = { location: "archived" };

      const result = await handler.execute(doc, params, {});

      Assert.isTrue(archived, "Should call archive method");
      Assert.isTrue(result.success, "Should return success");
      Assert.equal(result.archivedLocation, "archived", "Should return location");
    });

    framework.it("should handle document without archive method", async () => {
      const ArchiveDocumentAction = require("cp/actions/handlers/ArchiveDocumentAction.js");
      const handler = new ArchiveDocumentAction({ fileSystem: {} });

      const doc = {
        docID: "ABC123",
        docIDType: "UlyssesID",
        status: "writing",
      };
      const params = { location: "archived" };

      const result = await handler.execute(doc, params, {});

      Assert.isTrue(result.success, "Should still return success");
    });
  });
}