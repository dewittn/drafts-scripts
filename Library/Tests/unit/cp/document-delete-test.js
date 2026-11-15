/**
 * DocumentManager.delete() Unit Tests
 *
 * The Delete menu has three levels, each including the ones below it:
 * Recent, Pipeline (database record and tags), and Document (trash).
 * Covers the steps each level takes, their order, the confirmation, and
 * stopping when the database delete fails. Menu text comes from cp/ui.yaml,
 * which matches the delContent section of cp/settings.yaml.tpl.
 */

require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/mocks.js");
require("modules/cp/managers/DocumentManager.js");

const test = new TestAssertions("DocumentManager.delete()");
const settings = { delContent: loadRepoYAML("cp/ui.yaml").delContent };

// Runs delete() on a stub doc with the given menu choice and confirmation.
// Returns the steps taken, in order, plus the mock UI to inspect.
function runDelete(level, { confirm = "yes", dbFails = false } = {}) {
  const steps = [];
  const doc = {
    docID: "doc-1",
    title: "My Post",
    set inPipeline(value) {
      steps.push(`inPipeline=${value}`);
    },
    delete() {
      steps.push("trash");
    },
  };

  const db = createMockDatabase([{ docID: "doc-1" }]);
  db.setShouldFail(dbFails);
  const deleteRecord = db.deleteUsingDoc.bind(db);
  db.deleteUsingDoc = (target) => {
    steps.push("database");
    return deleteRecord(target);
  };

  const ui = createMockUI({
    promptResponses: { Delete: { button: level }, "Are you sure?": { button: confirm } },
  });
  const managerContext = {
    dependencyProvider: { ui, settings },
    database: db,
    recentRecords: { delete: () => steps.push("recent") },
    get activeDoc() {
      return doc;
    },
    setActiveDoc() {},
  };

  const result = new DocumentManager(managerContext).delete();
  return { result, steps, ui };
}

const menusShown = (ui) => ui.getInteractionsByType("buildMenu").map((menu) => menu.menuSettings.menuTitle);
const messages = (ui) => ui.getInteractionsByType("appMessage").map((entry) => [entry.messageType, entry.message]);

test.section("Remove from Recent");
let run = runDelete("recent");
test.assertEqual(run.result, true, "succeeds");
test.assertDeepEqual(run.steps, ["recent"], "only removes it from Recent");
test.assertDeepEqual(menusShown(run.ui), ["Delete"], "does not ask for confirmation");
test.assertDeepEqual(messages(run.ui), [["success", "Removed from Recent."]], "shows one success message");
test.assert(
  run.ui.getInteractionsByType("buildMenu")[0].menuSettings.menuMessage.endsWith("My Post"),
  "names the document in the menu"
);

test.section("Remove from Pipeline");
run = runDelete("pipeline");
test.assertDeepEqual(run.steps, ["database", "inPipeline=false", "recent"], "deletes the record, clears the tags, then Recent");
test.assertDeepEqual(menusShown(run.ui), ["Delete", "Are you sure?"], "asks for confirmation");
test.assertDeepEqual(messages(run.ui), [["success", "Removed from the Pipeline and Recent."]], "shows one success message");

test.section("Delete Document");
run = runDelete("document");
test.assertDeepEqual(
  run.steps,
  ["database", "inPipeline=false", "trash", "recent"],
  "deletes the record first, then the tags, the document, and Recent"
);

test.section("Answering No");
run = runDelete("document", { confirm: "no" });
test.assertEqual(run.result, false, "returns false");
test.assertDeepEqual(run.steps, [], "changes nothing");

test.section("Database failure");
run = runDelete("document", { dbFails: true });
test.assertEqual(run.result, false, "returns false");
test.assertDeepEqual(run.steps, ["database"], "stops before the tags, the document, and Recent");
test.assertDeepEqual(messages(run.ui), [["error", "Database Error!"]], "reports the database error");

test.summary();
