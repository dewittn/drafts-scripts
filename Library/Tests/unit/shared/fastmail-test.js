/**
 * Fastmail Unit Tests
 *
 * Stubs Credential and HTTP to check the JMAP requests createDraft() sends and
 * how it handles errors. The real API is only exercised inside Drafts.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/fastmail.js");

const test = new TestAssertions("Fastmail");

let credentialValues = { username: "me@example.com", token: "secret" };
Credential = {
  create: () => ({
    addTextField() {},
    addPasswordField() {},
    authorize: () => true,
    getValue: (key) => credentialValues[key],
  }),
};

// Each queued reply answers the next request in order.
let requests = [];
let replies = [];
HTTP = {
  create: () => ({
    request(settings) {
      requests.push(settings);
      const reply = replies.shift();
      return { success: reply.status == 200, statusCode: reply.status, responseText: JSON.stringify(reply.body) };
    },
  }),
};

const sessionReply = {
  status: 200,
  body: { apiUrl: "https://api.example.com/jmap/api/", primaryAccounts: { "urn:ietf:params:jmap:mail": "acc1" } },
};
const lookupReply = {
  status: 200,
  body: {
    methodResponses: [["Mailbox/query", { ids: ["mbox-drafts"] }, "mailbox"]],
  },
};
const createdReply = {
  status: 200,
  body: { methodResponses: [["Email/set", { created: { draft: { id: "email1" } } }, "email"]] },
};

function reset(...queued) {
  requests = [];
  replies = queued;
}

// --- createDraft ---
test.section("createDraft");

reset(sessionReply, lookupReply, createdReply);
let result = new Fastmail().createDraft({
  to: [{ name: "Jane", email: "jane@example.com" }],
  subject: "Hi",
  text: "**Hello**",
  html: "<p><strong>Hello</strong></p>",
});

test.assertDeepEqual(result, { success: true, email: { id: "email1" } }, "returns the created email");
test.assertEqual(requests.length, 3, "session, lookup, and create requests");
test.assertEqual(requests[0].url, "https://api.fastmail.com/jmap/session", "fetches the session");
test.assertEqual(requests[1].headers.Authorization, "Bearer secret", "sends the token");
test.assertEqual(requests[1].url, "https://api.example.com/jmap/api/", "posts to the session apiUrl");
test.assertDeepEqual(requests[1].data.methodCalls[0][1].filter, { role: "drafts" }, "finds the mailbox by role");

const [method, args] = requests[2].data.methodCalls[0];
const email = args.create.draft;
test.assertEqual(method, "Email/set", "creates with Email/set");
test.assertEqual(args.accountId, "acc1", "uses the primary mail account");
test.assertDeepEqual(email.mailboxIds, { "mbox-drafts": true }, "files into the Drafts mailbox");
test.assertDeepEqual(email.keywords, { $draft: true, $seen: true }, "marks as draft");
test.assertDeepEqual(email.from, [{ email: "me@example.com" }], "sends from the credential address");
test.assertFalsy(requests[1].data.using.includes("urn:ietf:params:jmap:submission"), "does not request the send scope");
test.assertDeepEqual(email.bodyValues.html, { value: "<p><strong>Hello</strong></p>" }, "includes the HTML part");
test.assertDeepEqual(email.textBody, [{ partId: "text", type: "text/plain" }], "includes the text part");
test.assertFalsy(
  requests.some((request) => request.data?.methodCalls.some(([name]) => name == "EmailSubmission/set")),
  "never submits the email",
);

reset(sessionReply, lookupReply, createdReply);
new Fastmail().createDraft({ subject: "Plain", text: "Body" });
test.assertFalsy(requests[2].data.methodCalls[0][1].create.draft.htmlBody, "omits htmlBody when no HTML is given");

// --- errors ---
test.section("errors");

reset({ status: 401, body: "Unauthorized" });
result = new Fastmail().createDraft({ subject: "Hi", text: "" });
test.assertFalsy(result.success, "fails on a bad token");
test.assert(result.error?.includes("401"), "error includes the status code");

reset(sessionReply, {
  status: 200,
  body: { methodResponses: [["error", { type: "unknownMethod" }, "mailbox"]] },
});
result = new Fastmail().createDraft({ subject: "Hi", text: "" });
test.assert(result.error?.includes("unknownMethod"), "surfaces JMAP method errors");

reset(sessionReply, lookupReply, {
  status: 200,
  body: { methodResponses: [["Email/set", { notCreated: { draft: { type: "invalidProperties", description: "bad to" } } }, "email"]] },
});
result = new Fastmail().createDraft({ subject: "Hi", text: "" });
test.assert(result.error?.includes("bad to"), "reports notCreated errors");

credentialValues = { username: "", token: "" };
reset();
result = new Fastmail().createDraft({ subject: "Hi", text: "" });
test.assert(result.error?.includes("credentials"), "fails without credentials");
test.assertEqual(requests.length, 0, "makes no requests without credentials");

test.summary();
