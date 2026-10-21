/**
 * Workspace Guard Unit Tests
 *
 * Characterization tests for every call to app.currentWindow.applyWorkspace:
 * when each site skips it because the workspace is already showing, when it
 * makes the call and with what, and what it does when no workspace is named.
 * applyWorkspace(undefined) resets the window to Drafts' "Default" workspace
 * (docs/reference/drafts-runtime.md), so a call with undefined is recorded as
 * such. The app, Workspace, editor, and Draft are stubs.
 */

require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/mocks.js");

const test = new TestAssertions("Workspace guard");

// Saved workspaces Workspace.find knows; any other name finds nothing, as
// "default" does in Drafts.
const savedWorkspaces = ["BVR", "Content", "Writing"];
/** @type {any} */ (globalThis).Workspace = {
  find: (name) => (savedWorkspaces.includes(name) ? { name } : undefined),
};

// Every applyWorkspace call, by the name of the workspace passed (undefined
// for none). showing() sets the workspace on screen and clears the list.
const applied = [];
function showing(name) {
  applied.length = 0;
  /** @type {any} */ (globalThis).app = {
    currentWorkspace: { name },
    currentWindow: { applyWorkspace: (workspace) => applied.push(workspace?.name) },
  };
}
const calls = () => [...applied];

/** @type {any} */ (globalThis).editor = {
  load() {},
  activate() {},
  getText: () => "",
  setText() {},
  setSelectedRange() {},
};

// A Draft class nr.js can extend, with the methods Template and newDraft use.
class StubDraft {
  constructor() {
    this.uuid = "STUB-DRAFT";
    this.content = "";
    this.tags = [];
  }

  static create() {
    return new StubDraft();
  }

  static find(uuid) {
    const found = new StubDraft();
    found.uuid = uuid;
    return found;
  }

  addTag(tag) {
    this.tags.push(tag);
  }

  hasTag() {
    return false;
  }

  setTemplateTag() {}

  processTemplate(template) {
    return template || "";
  }

  update() {}
}
/** @type {any} */ (globalThis).Draft = StubDraft;
/** @type {any} */ (globalThis).draft = new StubDraft();

require("vendor/nr.js");
require("modules/cp/templates/Template.js");
require("modules/cp/core/ContentPipeline.js");
require("modules/cp/documents/DraftsDocument.js");
require("modules/bvr/core/BVR.js");

const container = ServiceContainer.getInstance();

// --- ContentPipeline ---
test.section("ContentPipeline");

function startPipeline(defaultWorkspace) {
  container.reset();
  container.register("cpSettings", () => ({ defaultTag: "cp", defaultWorkspace }), true);
  container.register("cpUI", () => createMockUI(), true);
  new ContentPipeline();
}

showing("Content");
startPipeline("Content");
test.assertDeepEqual(calls(), [], "skipped when its workspace is showing");
showing("Default");
startPipeline("Content");
test.assertDeepEqual(calls(), ["Content"], "applied when another workspace is showing");
showing("Default");
startPipeline(undefined);
test.assertDeepEqual(calls(), [undefined], "with no defaultWorkspace setting, applied with undefined (resets to Default)");
showing(undefined);
startPipeline(undefined);
test.assertDeepEqual(calls(), [], "and skipped when the current workspace has no name either");

// --- DraftsDocument ---
test.section("DraftsDocument");

const openDocument = () => new DraftsDoc({ ui: createMockUI(), textUtilities: {}, settings: {} }, {}, { docID: "DOC-1" }).open();

showing("Default");
openDocument();
test.assertDeepEqual(calls(), [], "open() skips it when Default is showing");
showing("Writing");
openDocument();
test.assertDeepEqual(calls(), [undefined], "otherwise applies Workspace.find(\"default\"), which is undefined (resets to Default)");

// --- Template ---
test.section("Template");

const activateTemplate = (workspaceName) => new Template({ workspaceName }).activate();

showing("Writing");
activateTemplate("Writing");
test.assertDeepEqual(calls(), [], "activate() skips it when its workspace is showing");
showing("Default");
activateTemplate("Writing");
test.assertDeepEqual(calls(), ["Writing"], "applied when another workspace is showing");
showing("Default");
activateTemplate(undefined);
test.assertDeepEqual(calls(), [], "never applied when the template names no workspace");
activateTemplate("");
test.assertDeepEqual(calls(), [], "or an empty one");

// --- BVR ---
test.section("BVR");

function startBVR(workspace) {
  container.reset();
  const ui = createMockUI();
  container.register("bvrSettings", () => ({ workspace }), true);
  container.register("bvrUI", () => ui, true);
  new BVR();
  return ui;
}

showing("BVR");
let ui = startBVR("BVR");
test.assertDeepEqual(calls(), [], "skipped when its workspace is showing");
test.assertDeepEqual(
  ui.getInteractionsByType("appMessage").map((m) => [m.messageType, m.message]),
  [["info", "Workspace is already loaded."]],
  "and says it is already loaded",
);
showing("Default");
ui = startBVR("BVR");
test.assertDeepEqual(calls(), ["BVR"], "applied when another workspace is showing");
test.assertEqual(ui.getInteractionsByType("appMessage").length, 0, "without a message");
showing("Default");
startBVR(undefined);
test.assertDeepEqual(calls(), [undefined], "with no workspace setting, applied with undefined (resets to Default)");

// --- Draft.prototype.activate (vendor/nr.js) ---
test.section("Draft.prototype.activate");

/** @type {any} */ (globalThis).app.loadActionBarGroup = () => {};
const stubDraft = /** @type {any} */ (new StubDraft());
showing("Writing");
stubDraft.activate(undefined, "Writing");
test.assertDeepEqual(calls(), ["Writing"], "always applied, even when that workspace is showing");
showing("Default");
stubDraft.activate();
test.assertDeepEqual(calls(), [undefined], "with no name, applies Workspace.find(\"default\"), which is undefined");

// --- Actions/nr/morning-pages.js ---
test.section("morning pages action");

// Starting morning pages (the open draft is not one) applies "default"
// directly and again through Draft.prototype.activate, unguarded.
/** @type {any} */ (globalThis).Prompt = {
  create: () => ({ addButton() {}, show: () => true }),
};
showing("Default");
require("../Actions/nr/morning-pages.js");
test.assertDeepEqual(calls(), [undefined, undefined], "applied twice, both with undefined, even when Default is showing");

test.summary();
