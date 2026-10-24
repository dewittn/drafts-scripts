/**
 * FastmailSender Unit Tests
 *
 * Covers the Send to Fastmail flow with a stub UI, a stub Fastmail, and the
 * real fastmail settings from nr-settings.yaml.
 */

require("../Tests/fixtures/assertions.js");

// Stubbed before the require so FastmailSender's guard skips the real client.
let created = [];
/** @type {any} */
let createResult = { success: true, email: { id: "email1" } };
/** @type {any} */ (globalThis).Fastmail = class {
  createDraft(fields) {
    created.push(fields);
    return createResult;
  }
};
require("modules/nr/FastmailSender.js");

const test = new TestAssertions("FastmailSender");

/** @type {any} */ (globalThis).GitHubMarkdown = {
  create: () => ({ render: (markdown) => `<p>${markdown}</p>` }),
};

let calls = { fail: [], cancel: [], app: [] };
/** @type {any} */ (globalThis).context = {
  fail: (message) => calls.fail.push(message),
  cancel: (message) => calls.cancel.push(message),
};
/** @type {any} */ (globalThis).app = {
  displayErrorMessage: (message) => calls.app.push(message),
  displaySuccessMessage: (message) => calls.app.push(message),
};

// Each queued prompt answers the next menu: { shown, fieldValues }.
function makeUI({ prompts = [], yesNo = "no" } = {}) {
  const ui = { menus: [], yesNoMenus: [], messages: [] };
  ui.yesNoPrompt = (menu) => {
    ui.yesNoMenus.push(menu);
    menu.menuItems = [];
    return yesNo;
  };
  ui.buildMenu = (menu) => {
    ui.menus.push(menu);
    const reply = prompts.shift() ?? { shown: false };
    return { show: () => reply.shown ?? true, fieldValues: reply.fieldValues ?? {} };
  };
  ui.displayAppMessage = (type, message) => ui.messages.push({ type, message });
  return ui;
}

function reset() {
  created = [];
  createResult = { success: true, email: { id: "email1" } };
  calls = { fail: [], cancel: [], app: [] };
}

const fieldNames = (menu) => menu.menuItems.filter((item) => item.type == "textField").map((item) => item.data.name);

const settings = loadRepoYAML("nr-settings.yaml").fastmail;
const noSignature = { ...settings, signature: "" };
const complete = "Subject: Lunch\nTo: Jane Smith\nEmail: jane@example.com\n\nHi Jane";

// --- invalid addresses ---
test.section("invalid addresses");

reset();
let ui = makeUI();
let result = new FastmailSender(settings, ui).send("Email: ok@example.com, bad@host.\n\nBody");
test.assertEqual(result, false, "returns false");
test.assertDeepEqual(calls.fail, ["Invalid email address: bad@host."], "fails the action once with the bad address");
test.assertDeepEqual(calls.app, [], "shows no separate error banner");
test.assertEqual(ui.yesNoMenus.length + ui.menus.length, 0, "asks nothing");
test.assertEqual(created.length, 0, "creates no draft");

// --- signature ---
test.section("signature");

reset();
ui = makeUI({ yesNo: "yes" });
new FastmailSender(settings, ui).send(complete);
test.assertEqual(ui.yesNoMenus[0]?.menuTitle, "Send to Fastmail", "asks with the Send to Fastmail title");
test.assertEqual(ui.yesNoMenus[0]?.menuMessage, "Attach your signature?", "asks to attach the signature");
test.assertEqual(settings.signaturePrompt.menuItems, undefined, "the signature prompt settings are not changed");
test.assert(created[0]?.text.endsWith(settings.signature.trim().replace(/\\/g, "")), "yes appends the signature to the text");
test.assert(created[0]?.html.includes("Nelson/Roberto"), "yes appends the signature to the HTML");

reset();
ui = makeUI({ yesNo: "no" });
new FastmailSender(settings, ui).send(complete);
test.assertEqual(created[0]?.text, "Hi Jane", "no leaves the body alone");

reset();
ui = makeUI({ yesNo: "yes" });
new FastmailSender(noSignature, ui).send(complete);
test.assertEqual(ui.yesNoMenus.length, 0, "no question when there is no signature");

// --- missing fields ---
test.section("missing fields");

const missingCases = [
  { content: "Email: jane@example.com\n\nBody", fields: ["subject"], message: "No Subject: line found." },
  { content: "Subject: Hi\nTo: Jane\n\nBody", fields: ["to", "email"], message: "No Email: line found." },
  { content: "Body", fields: ["subject", "to", "email"], message: "No Subject: or Email: line found." },
];
for (const { content, fields, message } of missingCases) {
  reset();
  ui = makeUI({ prompts: [{ shown: false }] });
  new FastmailSender(noSignature, ui).send(content);
  const menu = ui.menus[0];
  test.assertDeepEqual(fieldNames(menu), fields, `${message} shows ${fields.join(", ")}`);
  test.assertEqual(menu.menuMessage, message, `${message} message`);
  test.assertEqual(menu.menuTitle, "Send to Fastmail", `${message} title`);
  test.assertDeepEqual(
    menu.menuItems.filter((item) => item.type == "button").map((item) => item.data.name),
    ["Create Draft"],
    `${message} has the Create Draft button`,
  );
}

reset();
ui = makeUI({ prompts: [{ shown: false }] });
new FastmailSender(noSignature, ui).send("Subject: Hi\nTo: Jane\n\nBody");
const toField = ui.menus[0].menuItems.find((item) => item.data.name == "to");
const emailField = ui.menus[0].menuItems.find((item) => item.data.name == "email");
test.assertEqual(toField.data.initialText, "Jane", "To is filled with the draft's To name");
test.assertEqual(emailField.data.label, "Email Address", "Email Address label");
test.assertDeepEqual(
  emailField.data.options,
  { keyboard: "emailAddress", autocapitalization: "none", autocorrect: false },
  "email field uses the email keyboard options",
);
test.assertEqual(
  settings.missingFields.menuSettings.menuItems.find((item) => item.data.name == "to").data.initialText,
  undefined,
  "the menu settings are not changed",
);
test.assertEqual(settings.missingFields.menuSettings.menuMessage, undefined, "the menu message is not saved to settings");

// --- re-ask on a bad typed address ---
test.section("re-ask on a bad address");

reset();
ui = makeUI({
  prompts: [
    { fieldValues: { subject: " Hi ", to: "Jane", email: " jane@nowhere " } },
    { fieldValues: { to: "Jane", email: "jane@example.com" } },
  ],
});
result = new FastmailSender(noSignature, ui).send("Body");
test.assertEqual(ui.menus.length, 2, "asks again");
test.assertEqual(ui.menus[1].menuMessage, '"jane@nowhere" is not a valid email address.', "says which address was not valid");
test.assertDeepEqual(fieldNames(ui.menus[1]), ["to", "email"], "asks again only for what is still missing");
test.assertDeepEqual(created[0]?.to, [{ name: "Jane", email: "jane@example.com" }], "uses the corrected address");
test.assertEqual(created[0]?.subject, "Hi", "keeps the typed subject, trimmed");
test.assertEqual(result, createResult, "returns the Fastmail result");

reset();
ui = makeUI({ prompts: [{ fieldValues: { subject: "Hi", to: "Jane", email: "" } }] });
new FastmailSender(noSignature, ui).send("Body");
test.assertEqual(ui.menus.length, 1, "a blank address does not ask again");
test.assertDeepEqual(created[0]?.to, [], "a blank address creates the draft without a recipient");

// --- cancel ---
test.section("cancel");

reset();
ui = makeUI({ prompts: [{ shown: false }] });
result = new FastmailSender(noSignature, ui).send("Body");
test.assertEqual(result, false, "returns false");
test.assertDeepEqual(calls.cancel, ["Missing email fields"], "cancels the action");
test.assertEqual(created.length, 0, "creates no draft");
test.assertDeepEqual(calls.fail, [], "does not fail the action");
test.assertEqual(ui.messages.length, 0, "shows no message");

// --- success and failure ---
test.section("success and failure");

reset();
ui = makeUI();
result = new FastmailSender(noSignature, ui).send("# Note\n" + complete + "\n\n**Bold**");
test.assertDeepEqual(
  created[0],
  {
    to: [{ name: "Jane Smith", email: "jane@example.com" }],
    subject: "Lunch",
    text: "Hi Jane\n\n**Bold**",
    html: "<p>Hi Jane\n\n**Bold**</p>",
  },
  "creates the draft from the email fields",
);
test.assertEqual(ui.menus.length, 0, "no prompt when nothing is missing");
test.assertDeepEqual(ui.messages, [{ type: "success", message: "Fastmail draft created for Jane Smith" }], "reports success through the UI");
test.assertDeepEqual(calls.app, [], "does not call app directly");
test.assertDeepEqual(calls.fail.concat(calls.cancel), [], "neither fails nor cancels");

reset();
ui = makeUI({ prompts: [{ fieldValues: { subject: "Hi", email: "" } }] });
new FastmailSender(noSignature, ui).send("Body");
test.assertEqual(ui.messages[0]?.message, "Fastmail draft created", "no recipient leaves the name out");

reset();
ui = makeUI();
new FastmailSender(noSignature, ui).send("Subject: Hi\nEmail: a@example.com, B <b@example.com>\n\nBody");
test.assertEqual(ui.messages[0]?.message, "Fastmail draft created for a@example.com, B", "names each recipient, or its address");

reset();
createResult = { success: false, error: "Fastmail Error: Drafts mailbox not found" };
ui = makeUI();
result = new FastmailSender(noSignature, ui).send(complete);
test.assertEqual(result, false, "returns false when Fastmail fails");
test.assertDeepEqual(calls.fail, ["Fastmail Error: Drafts mailbox not found"], "fails the action with the Fastmail error");
test.assertEqual(ui.messages.length, 0, "shows no success message");

test.summary();
