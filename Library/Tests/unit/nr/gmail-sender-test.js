/**
 * GmailSender Unit Tests
 *
 * The shared flow is covered through FastmailSender in fastmail-sender-test.js.
 * This checks what Gmail adds: its client, its titles, and its settings, which
 * reuse Fastmail's through YAML anchors.
 */

require("../Tests/fixtures/assertions.js");

// Stubbed before the require so GmailSender's guard skips the real client.
let created = [];
/** @type {any} */ (globalThis).Gmail = class {
  createDraft(fields) {
    created.push(fields);
    return { success: true, id: "draft1" };
  }
};
require("modules/nr/GmailSender.js");

const test = new TestAssertions("GmailSender");

/** @type {any} */ (globalThis).GitHubMarkdown = {
  create: () => ({ render: (markdown) => `<p>${markdown}</p>` }),
};

let openedURLs = [];
/** @type {any} */ (globalThis).app = { openURL: (url) => openedURLs.push(url) };

let cancelled = [];
let failed = [];
/** @type {any} */ (globalThis).context = {
  cancel: (message) => cancelled.push(message),
  fail: (message) => failed.push(message),
};

function makeUI(fieldValues = {}) {
  const ui = { menus: [], yesNoMenus: [], messages: [] };
  ui.yesNoPrompt = (menu) => {
    ui.yesNoMenus.push(menu);
    return "no";
  };
  ui.buildMenu = (menu) => {
    ui.menus.push(menu);
    return { show: () => true, fieldValues };
  };
  ui.displayAppMessage = (type, message) => ui.messages.push({ type, message });
  return ui;
}

const allSettings = loadRepoYAML("nr-settings.yaml");
const settings = allSettings.gmail;

// --- sending ---
test.section("sending");

let ui = makeUI();
const result = new GmailSender(settings, ui).send(
  "# Email to Jane\n\nTo: Jane Smith\nEmail: jane@example.com\nSubject: Lunch\n\nHi Jane",
);
test.assertEqual(result?.success, true, "returns the client's result");
test.assertDeepEqual(created[0]?.to, [{ name: "Jane Smith", email: "jane@example.com" }], "passes the recipient");
test.assertEqual(created[0]?.subject, "Lunch", "passes the subject");
test.assertEqual(created[0]?.text, "Hi Jane", "passes only the body as text");
test.assertEqual(created[0]?.html, "<p>Hi Jane</p>", "passes only the body as HTML");
test.assertEqual(ui.messages[0]?.message, "Gmail draft created for Jane Smith", "names Gmail in the success message");
test.assertEqual(ui.yesNoMenus[0]?.menuTitle, "Send to Gmail", "asks about the signature under Gmail's title");

created = [];
ui = makeUI({ subject: "Lunch", to: "", email: "jane@example.com" });
new GmailSender(settings, ui).send("Hi Jane");
test.assertEqual(ui.menus[0]?.menuTitle, "Send to Gmail", "asks for missing fields under Gmail's title");
test.assertEqual(ui.menus[0]?.menuItems.length, 4, "keeps Fastmail's fields and button");

// --- opening Gmail ---
test.section("opening Gmail");

const complete = "To: Jane\nEmail: jane@example.com\nSubject: Lunch\n\nHi Jane";

openedURLs = [];
new GmailSender(settings, makeUI()).send(complete);
test.assertDeepEqual(openedURLs, [settings.draftsURL], "opens the Drafts folder once the draft exists");

openedURLs = [];
new GmailSender(settings, makeUI()).send("Email: bad@host.\n\nHi Jane");
test.assertEqual(failed.length, 1, "a bad address fails the action");
test.assertDeepEqual(openedURLs, [], "a failed draft opens nothing");

openedURLs = [];
const cancellingUI = makeUI();
cancellingUI.buildMenu = () => ({ show: () => false, fieldValues: {} });
new GmailSender(settings, cancellingUI).send("Hi Jane");
test.assertEqual(cancelled.length, 1, "cancelling the prompt cancels the action");
test.assertDeepEqual(openedURLs, [], "a cancelled draft opens nothing");

// --- settings ---
test.section("settings");

test.assertEqual(settings.signature, allSettings.fastmail.signature, "shares Fastmail's signature");
test.assertDeepEqual(settings.missingFields.messages, allSettings.fastmail.missingFields.messages, "shares the messages");
test.assertEqual(allSettings.fastmail.missingFields.menuSettings.menuTitle, "Send to Fastmail", "Fastmail keeps its title");

test.summary();
