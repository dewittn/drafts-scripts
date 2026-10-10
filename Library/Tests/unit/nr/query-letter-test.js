/**
 * QueryLetter Unit Tests
 *
 * Covers agent label parsing and the create() flow using a mock source draft,
 * mock UI, and a stubbed Template class.
 */

require("../Tests/fixtures/assertions.js");
require("modules/nr/QueryLetter.js");

const test = new TestAssertions("QueryLetter");

// --- parseAgentLabel ---
test.section("parseAgentLabel");

test.assertDeepEqual(
  QueryLetter.parseAgentLabel("Jane Doe"),
  { name: "Jane Doe", note: "" },
  "plain name",
);
test.assertDeepEqual(
  QueryLetter.parseAgentLabel("**Jane Doe** (Big Agency)"),
  { name: "Jane Doe", note: "Big Agency" },
  "strips emphasis and extracts parenthetical",
);
test.assertDeepEqual(
  QueryLetter.parseAgentLabel("Jane Doe - queried via referral"),
  { name: "Jane Doe", note: "queried via referral" },
  "dash separated note",
);
test.assertDeepEqual(
  QueryLetter.parseAgentLabel("[Jane Doe](https://example.com) (Agency) – fall 2026"),
  { name: "Jane Doe", note: "Agency – fall 2026" },
  "markdown link, parenthetical, and dash note",
);

// --- create() ---
test.section("create()");

const originalTemplate = Template;
let createdTemplates = [];
Template = class {
  static load() {
    return "Dear [[agent]],";
  }
  constructor(settings) {
    this.settings = settings;
    this.archived = false;
    this.saved = false;
    this.activated = false;
    createdTemplates.push(this);
  }
  archive() {
    this.archived = true;
    return this;
  }
  save() {
    this.saved = true;
    return this;
  }
  activate() {
    this.activated = true;
    return this;
  }
};

function makeTask(label, isCompleted) {
  return { label, line: `- [${isCompleted ? "x" : " "}] ${label}`, isCompleted };
}

function makeSourceDraft(tasks) {
  return {
    tasks,
    completed: [],
    updated: 0,
    get incompleteTasks() {
      return this.tasks.filter((task) => !task.isCompleted);
    },
    completeTask(task) {
      this.completed.push(task.label);
      task.isCompleted = true;
      return true;
    },
    update() {
      this.updated++;
    },
  };
}

function makeUI(pickerIndex, extraFields = {}, shown = true) {
  const ui = { messages: [], menus: [] };
  ui.buildMenu = (menu) => {
    ui.menus.push(menu);
    const pickerName = menu.menuItems[0].data.name;
    return {
      show: () => shown,
      fieldValues: { [pickerName]: [pickerIndex], ...extraFields },
    };
  };
  ui.displayAppMessage = (type, message) => ui.messages.push({ type, message });
  ui.displayErrorMessage = (message) => {
    ui.messages.push({ type: "error", message });
    return false;
  };
  return ui;
}

const settings = {
  templateFile: "nr/query-letter.md",
  draftTags: ["authoring/wfid/query"],
  pickerData: { name: "agent", label: "Agent" },
  menuSettings: {
    menuTitle: "New Query Letter",
    menuItems: [{ type: "button", data: { name: "Create", value: "create" } }],
  },
};

// Happy path
createdTemplates = [];
let source = makeSourceDraft([
  makeTask("Alice Agent", true),
  makeTask("Bob Books (Bookish Lit)", false),
  makeTask("Carol Cover", false),
]);
let ui = makeUI(1, { represented: "SOME TITLE", genre: ["upmarket literary fiction"] });
let result = new QueryLetter(settings, ui, source).create();

test.assertDeepEqual(
  ui.menus[0].menuItems[0].data.columns,
  [["Bob Books (Bookish Lit)", "Carol Cover"]],
  "picker lists only unqueried agents",
);
test.assertEqual(ui.menus[0].menuItems.length, 2, "picker is prepended to configured menu items");
test.assertEqual(settings.menuSettings.menuItems.length, 1, "shared menu settings are not mutated");
test.assertEqual(createdTemplates.length, 1, "one template draft created");
test.assertEqual(createdTemplates[0].settings.templateTags.agent, "Carol Cover", "agent tag set from picker");
test.assertEqual(createdTemplates[0].settings.templateTags.represented, "SOME TITLE", "extra field becomes template tag");
test.assertEqual(createdTemplates[0].settings.templateTags.genre, "upmarket literary fiction", "select field becomes template tag");
test.assertDeepEqual(createdTemplates[0].settings.draftTags, ["authoring/wfid/query"], "draft tagged");
test.assert(createdTemplates[0].archived, "new draft is archived");
test.assert(createdTemplates[0].saved, "new draft is saved");
test.assert(createdTemplates[0].activated, "new draft is loaded in editor");
test.assertDeepEqual(source.completed, ["Carol Cover"], "selected agent checked off in source");
test.assertEqual(source.updated, 1, "source draft updated once");
test.assertEqual(ui.messages[0]?.type, "success", "success message shown");
test.assertEqual(result, createdTemplates[0], "create() returns the template");

// Second run excludes the newly completed agent
createdTemplates = [];
ui = makeUI(0, { genre: ["literary fiction", "magical realism"] });
new QueryLetter(settings, ui, source).create();
test.assertEqual(createdTemplates[0].settings.templateTags.genre, "literary fiction, magical realism", "multi-select values are joined");
test.assertDeepEqual(
  ui.menus[0].menuItems[0].data.columns,
  [["Bob Books (Bookish Lit)"]],
  "completed agent excluded on next run",
);
test.assertEqual(createdTemplates[0].settings.templateTags.agentNote, "Bookish Lit", "agentNote tag carries parenthetical");

// Cancelled prompt
createdTemplates = [];
source = makeSourceDraft([makeTask("Dan Deal", false)]);
ui = makeUI(0, {}, false);
result = new QueryLetter(settings, ui, source).create();
test.assertEqual(result, false, "cancelled prompt returns false");
test.assertEqual(createdTemplates.length, 0, "no draft created when cancelled");
test.assertDeepEqual(source.completed, [], "no task completed when cancelled");

// No agents remaining
source = makeSourceDraft([makeTask("Eve Everyone", true)]);
ui = makeUI(0);
new QueryLetter(settings, ui, source).create();
test.assertEqual(ui.messages[0]?.type, "info", "info message when every agent queried");
test.assertEqual(ui.menus.length, 0, "no prompt when every agent queried");

// Missing source draft
ui = makeUI(0);
const missing = new QueryLetter({ ...settings, sourceDraftUUID: "nope", sourceTag: "none" }, ui, null);
Draft = { find: () => undefined, query: () => [] };
missing.create();
test.assertEqual(ui.messages[0]?.type, "error", "error when source draft missing");

// --- sourceDraft lookup ---
test.section("sourceDraft lookup");

const storedCopy = { uuid: "LIST-1", ...makeSourceDraft([makeTask("Fay Find", false)]) };
const taggedCopy = { uuid: "LIST-2", ...makeSourceDraft([makeTask("Gus Gone", false)]) };
Draft = {
  find: (uuid) => (uuid == "LIST-1" ? storedCopy : undefined),
  query: () => [taggedCopy],
};

draft = undefined;
let lookup = new QueryLetter({ ...settings, sourceDraftUUID: "LIST-1", sourceTag: "t" }, makeUI(0), null);
test.assertEqual(lookup.sourceDraft, storedCopy, "finds source draft by UUID when nothing is open");

lookup = new QueryLetter({ ...settings, sourceDraftUUID: "missing", sourceTag: "t" }, makeUI(0), null);
test.assertEqual(lookup.sourceDraft, taggedCopy, "falls back to tag query when UUID is missing");

draft = { uuid: "LIST-1", ...makeSourceDraft([makeTask("Fay Find", false)]) };
lookup = new QueryLetter({ ...settings, sourceDraftUUID: "LIST-1", sourceTag: "t" }, makeUI(0), null);
test.assertEqual(lookup.sourceDraft, draft, "uses the global draft when the agent list is the open draft");

draft = { uuid: "OTHER", ...makeSourceDraft([]) };
lookup = new QueryLetter({ ...settings, sourceDraftUUID: "LIST-1", sourceTag: "t" }, makeUI(0), null);
test.assertEqual(lookup.sourceDraft, storedCopy, "ignores the global draft when a different draft is open");

Template = originalTemplate;
test.summary();
