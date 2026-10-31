/**
 * Gmail Unit Tests
 *
 * Stubs Credential and HTTP to check the request createDraft() sends to the
 * Apps Script web app and how it handles replies. The real web app is only
 * exercised inside Drafts.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/gmail.js");

const test = new TestAssertions("Gmail");

let credentialValues = {};
/** @type {any} */ (globalThis).Credential = {
  create: () => ({
    addTextField() {},
    addPasswordField() {},
    authorize: () => true,
    getValue: (key) => credentialValues[key],
  }),
};

let requests = [];
let reply = {};
/** @type {any} */ (globalThis).HTTP = {
  create: () => ({
    request(settings) {
      requests.push(settings);
      return { success: reply.status == 200, statusCode: reply.status, responseText: reply.text };
    },
  }),
};

// Quiets the error logging the client does on purpose.
const originalLog = console.log;
console.log = () => {};

function reset(status = 200, text = JSON.stringify({ success: true, id: "draft1" })) {
  credentialValues = { url: "https://script.example.com/exec", secret: "key" };
  requests = [];
  reply = { status, text };
}

const fields = {
  to: [{ name: "Jane Smith", email: "jane@example.com" }],
  subject: "Lunch",
  text: "Hi Jane",
  html: "<p>Hi Jane</p>",
};

// --- formatRecipient ---
test.section("formatRecipient");

test.assertEqual(Gmail.formatRecipient({ name: null, email: "a@b.com" }), "a@b.com", "no name is the bare address");
test.assertEqual(
  Gmail.formatRecipient({ name: "Jane Smith", email: "a@b.com" }),
  '"Jane Smith" <a@b.com>',
  "quotes the name",
);
test.assertEqual(
  Gmail.formatRecipient({ name: "Smith, Jane", email: "a@b.com" }),
  '"Smith, Jane" <a@b.com>',
  "keeps a comma inside the quotes",
);
test.assertEqual(
  Gmail.formatRecipient({ name: 'Jane "JJ" Smith', email: "a@b.com" }),
  '"Jane \\"JJ\\" Smith" <a@b.com>',
  "escapes quotes in the name",
);

// --- createDraft ---
test.section("createDraft");

reset();
let result = new Gmail().createDraft(fields);
test.assertDeepEqual(result, { success: true, id: "draft1" }, "returns the new draft's id");
test.assertEqual(requests.length, 1, "makes one request");
test.assertEqual(requests[0].url, "https://script.example.com/exec", "posts to the web app URL");
test.assertEqual(requests[0].method, "POST", "uses POST");
test.assertEqual(requests[0].encoding, "json", "encodes the body as JSON");
test.assertDeepEqual(
  requests[0].data,
  {
    secret: "key",
    to: '"Jane Smith" <jane@example.com>',
    subject: "Lunch",
    text: "Hi Jane",
    html: "<p>Hi Jane</p>",
  },
  "sends the fields the web app reads",
);

reset();
new Gmail().createDraft({
  ...fields,
  to: [
    { name: null, email: "a@b.com" },
    { name: "Jane", email: "jane@example.com" },
  ],
});
test.assertEqual(requests[0].data.to, 'a@b.com, "Jane" <jane@example.com>', "joins several recipients");

reset();
new Gmail().createDraft({ ...fields, to: [] });
test.assertEqual(requests[0].data.to, "", "no recipients sends an empty To");

// --- errors ---
test.section("errors");

reset();
credentialValues = {};
result = new Gmail().createDraft(fields);
test.assertEqual(result.success, false, "missing credentials fail");
test.assertEqual(requests.length, 0, "missing credentials make no request");

reset(200, JSON.stringify({ error: "Not allowed" }));
result = new Gmail().createDraft(fields);
test.assertDeepEqual(result, { success: false, error: "Gmail Error: Not allowed" }, "reports the web app's error");

reset(200, "<!DOCTYPE html><html><body>Sign in</body></html>");
result = new Gmail().createDraft(fields);
test.assertEqual(result.success, false, "an HTML reply fails");
test.assert(result.error.includes("did not create a draft"), "explains an HTML reply");

reset(500, "Server error");
result = new Gmail().createDraft(fields);
test.assertEqual(result.success, false, "a failed request fails");
test.assert(result.error.includes("500"), "reports the status code");

console.log = originalLog;
test.summary();
