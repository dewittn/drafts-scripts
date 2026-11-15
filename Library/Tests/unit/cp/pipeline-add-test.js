/**
 * PipelineManager.addDocument() Unit Tests: documents already in the database
 *
 * A document can have a database record while its tags say it is not in the
 * pipeline (old test data, tags edited by hand). Update Status used to loop
 * on such a document. addDocument() now restores the tags from the record
 * and returns true; a document whose tags already agree gets the "already
 * exists" message.
 */

require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/mocks.js");
require("modules/cp/managers/PipelineManager.js");

const test = new TestAssertions("PipelineManager.addDocument() existing record");
const settings = { addDocToPipeline: loadRepoYAML("cp/ui.yaml").addDocToPipeline };

// Runs addDocument() for a doc that has a database record with status
// "Developing". tagsInPipeline sets whether its tags already show that.
function runAdd({ tagsInPipeline, status = "" }) {
  const steps = [];
  const doc = {
    title: "Test Doc",
    inPipeline: tagsInPipeline,
    status: status,
    get statusIsNotSet() {
      return this.status == "";
    },
  };
  const watched = new Proxy(doc, {
    set(target, key, value) {
      steps.push(`${String(key)}=${typeof value == "object" ? "record" : value}`);
      target[key] = value;
      return true;
    },
  });

  const record = { Status: "Developing" };
  const ui = createMockUI();
  const managerContext = {
    dependencyProvider: { ui, settings },
    database: { docIsInPipeline: () => true, currentRecord: record, databaseError: false },
    get activeDoc() {
      return watched;
    },
    setActiveDoc() {},
  };

  const result = new PipelineManager(managerContext).addDocument("DraftsID");
  const messages = ui.getInteractionsByType("appMessage").map((entry) => entry.message);
  return { result, steps, messages };
}

test.section("Tags missing");
let run = runAdd({ tagsInPipeline: false });
test.assertEqual(run.result, true, "returns true so Update Status can carry on");
test.assertDeepEqual(run.steps, ["record=record", "status=Developing", "inPipeline=true"], "restores the status from the record, then the pipeline tags");
test.assertDeepEqual(run.messages, [], "shows no message");

test.section("Tags missing, status tag present");
run = runAdd({ tagsInPipeline: false, status: "Editing" });
test.assertDeepEqual(run.steps, ["record=record", "inPipeline=true"], "keeps the document's own status");

test.section("Tags already agree");
run = runAdd({ tagsInPipeline: true });
test.assertEqual(run.result, true, "returns true");
test.assertDeepEqual(run.steps, [], "changes nothing");
test.assertDeepEqual(run.messages, [settings.addDocToPipeline.docExistsMessage], "says it already exists");

test.summary();
