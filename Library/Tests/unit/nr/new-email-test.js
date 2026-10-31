/**
 * NewEmail Unit Tests
 *
 * Covers the prompt loop and draft creation using a mock UI and a stubbed
 * Template class, and checks the template against EmailDraft.
 */

require("../Tests/fixtures/assertions.js");

// Stubbed before the require so NewEmail's guard skips the real class.
let createdTemplates = [];
let templateFound = true;
/** @type {any} */ (globalThis).Template = class {
  static load() {
    return templateFound ? "template text" : undefined;
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
require("modules/nr/NewEmail.js");

const test = new TestAssertions("NewEmail");

// Each reply answers the next menu: { shown, fieldValues }.
function makeUI(replies) {
  const ui = { menus: [], errors: [] };
  ui.buildMenu = (menu) => {
    ui.menus.push(menu);
    const reply = replies[ui.menus.length - 1] ?? {};
    return { show: () => reply.shown ?? true, fieldValues: reply.fieldValues ?? {} };
  };
  ui.displayErrorMessage = (message) => {
    ui.errors.push(message);
    return false;
  };
  return ui;
}

const settings = {
  templateFile: "nr/new-email.mustache",
  draftTags: ["email"],
  messages: { missingName: "Enter the name.", invalidAddress: '"[[address]]" is not valid.' },
  menuSettings: {
    menuTitle: "New Email",
    menuMessage: "Who is this email to?",
    menuItems: [
      { type: "textField", data: { name: "name", label: "Name" } },
      { type: "textField", data: { name: "email", label: "Email Address" } },
      { type: "button", data: { name: "Create", value: "create" } },
    ],
  },
};

function run(replies) {
  createdTemplates = [];
  const ui = makeUI(replies);
  const result = new NewEmail(settings, ui).create();
  return { ui, result, made: createdTemplates[0] };
}

const initialText = (menu, name) => menu.menuItems.find((item) => item.data.name == name).data.initialText;

// --- create() ---
test.section("create()");

let outcome = run([{ fieldValues: { name: " Jane Smith ", email: " jane@example.com " } }]);
test.assertEqual(createdTemplates.length, 1, "creates one draft");
test.assertEqual(outcome.made?.settings.templateFile, "nr/new-email.mustache", "uses the configured template");
test.assertDeepEqual(
  outcome.made?.settings.templateTags,
  { name: "Jane Smith", email: "jane@example.com" },
  "trimmed name and address become template tags",
);
test.assertDeepEqual(outcome.made?.settings.draftTags, ["email"], "tags the draft");
test.assertTruthy(outcome.made?.archived, "archives the draft");
test.assertTruthy(outcome.made?.saved, "saves the draft");
test.assertTruthy(outcome.made?.activated, "opens the draft");
test.assertEqual(outcome.ui.menus.length, 1, "asks once when the answers are fine");

outcome = run([{ fieldValues: { name: "Jane", email: "" } }]);
test.assertEqual(outcome.made?.settings.templateTags.email, "", "a blank address is allowed");
test.assertEqual(outcome.ui.menus.length, 1, "a blank address does not ask again");

outcome = run([{ fieldValues: { name: "Jane", email: "Jane Smith <jane@example.com>" } }]);
test.assertEqual(outcome.ui.menus.length, 1, "accepts a name and address form");

// --- Asking again ---
test.section("Asking again");

outcome = run([
  { fieldValues: { name: "Jane", email: "jane@nowhere" } },
  { fieldValues: { name: "Jane", email: "jane@example.com" } },
]);
test.assertEqual(outcome.ui.menus.length, 2, "asks again for an invalid address");
test.assertEqual(outcome.ui.menus[1].menuMessage, '"jane@nowhere" is not valid.', "shows the typed address");
test.assertEqual(initialText(outcome.ui.menus[1], "name"), "Jane", "keeps the typed name");
test.assertEqual(initialText(outcome.ui.menus[1], "email"), "jane@nowhere", "keeps the typed address");
test.assertEqual(outcome.made?.settings.templateTags.email, "jane@example.com", "uses the corrected address");

outcome = run([
  { fieldValues: { name: "  ", email: "jane@example.com" } },
  { fieldValues: { name: "Jane", email: "jane@example.com" } },
]);
test.assertEqual(outcome.ui.menus[1].menuMessage, "Enter the name.", "asks again for a blank name");
test.assertEqual(createdTemplates.length, 1, "creates one draft after the retry");
test.assertEqual(settings.menuSettings.menuItems[0].data.initialText, undefined, "the settings are not changed");

// --- Stopping early ---
test.section("Stopping early");

outcome = run([{ shown: false }]);
test.assertEqual(outcome.result, false, "cancel returns false");
test.assertEqual(createdTemplates.length, 0, "cancel creates no draft");

outcome = run([
  { fieldValues: { name: "", email: "" } },
  { shown: false },
]);
test.assertEqual(createdTemplates.length, 0, "cancel on a retry creates no draft");

templateFound = false;
outcome = run([{ fieldValues: { name: "Jane", email: "" } }]);
test.assertEqual(outcome.ui.menus.length, 0, "a missing template stops before prompting");
test.assertEqual(outcome.ui.errors.length, 1, "a missing template shows an error");
templateFound = true;

// --- The template's shape ---
test.section("EmailDraft reads the result");

const email = new EmailDraft(
  "# Email to Jane Smith\n\nTo: Jane Smith\nEmail: jane@example.com\nSubject: \n\nHello Jane Smith,\n\n",
);
test.assertEqual(email.subject, "", "blank subject, so Send to Fastmail asks for it");
test.assertDeepEqual(email.recipients, [{ name: "Jane Smith", email: "jane@example.com" }], "reads the recipient");
test.assertEqual(email.body, "Hello Jane Smith,", "the heading and fields stay out of the body");

test.summary();
