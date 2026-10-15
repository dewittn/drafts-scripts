/**
 * EmailDraft Unit Tests
 *
 * Covers header field parsing, heading removal, and recipient parsing.
 */

require("../Tests/fixtures/assertions.js");
require("modules/nr/EmailDraft.js");

const test = new TestAssertions("EmailDraft");

// --- fields and body ---
test.section("fields and body");

let email = new EmailDraft(
  "# Email to Jane\nTo: Jane Smith\nemail: jane@example.com\nSUBJECT: Lunch on Friday\n\nHi Jane,\n\nAre you free?",
);
test.assertEqual(email.subject, "Lunch on Friday", "reads subject case-insensitively");
test.assertDeepEqual(email.recipients, [{ name: "Jane Smith", email: "jane@example.com" }], "pairs To name with Email address");
test.assertEqual(email.body, "Hi Jane,\n\nAre you free?", "drops heading and field lines from body");

email = new EmailDraft("Subject: Hello\nTo: Jane\n\nBody");
test.assertEqual(email.subject, "Hello", "fields work without a heading");
test.assertDeepEqual(email.recipients, [], "a To name without an address gives no recipient");
test.assertEqual(email.to, "Jane", "keeps the raw To name for prompting");
email.recipients = EmailDraft.parseRecipients(email.to, "jane@example.com");
test.assertDeepEqual(email.recipients, [{ name: "Jane", email: "jane@example.com" }], "recipients can be set after parsing");
test.assertEqual(email.body, "Body", "body without heading");

email = new EmailDraft("Just a note\nTo: someone");
test.assertEqual(email.body, "Just a note\nTo: someone", "keeps a first line that is not a heading");
test.assertEqual(email.subject, "", "no subject when there is no Subject line");
test.assertEqual(email.to, "", "no To name when there is no To line");

email = new EmailDraft("# Email\nSubject: Hi\n\nThanks,\nNelson\nEmail: nr@example.com");
test.assertEqual(email.body, "Thanks,\nNelson\nEmail: nr@example.com", "leaves field-like lines in the body alone");
test.assertDeepEqual(email.recipients, [], "signature Email line is not a recipient");

email = new EmailDraft("\n\n# Heading\n\nSubject: First\nSubject: Second\n\nBody");
test.assertEqual(email.subject, "First", "first Subject line wins; leading blanks skipped");
test.assertEqual(email.body, "Body", "duplicate field lines are removed");

// --- signature ---
test.section("signature");

email = new EmailDraft("Subject: Hi\n\nBody\n");
email.addSignature("Nelson\nnr@example.com\n");
test.assertEqual(email.body, "Body\n\nNelson\nnr@example.com", "appends signature after a blank line");

email = new EmailDraft("Subject: Hi\n\nBody");
email.addSignature("  ");
email.addSignature(undefined);
test.assertEqual(email.body, "Body", "skips an empty or missing signature");

// --- plain text ---
test.section("plain text");

email = new EmailDraft("Subject: Hi\n\nCost is \\$5 \\*each\\*\n\n\\-\\-\\-\nNelson\\\\ \\a");
test.assertEqual(email.text, "Cost is $5 *each*\n\n---\nNelson\\ \\a", "strips Markdown escapes but not other backslashes");
test.assertEqual(email.body, "Cost is \\$5 \\*each\\*\n\n\\-\\-\\-\nNelson\\\\ \\a", "body keeps escapes for HTML");

// --- recipients ---
test.section("recipients");

test.assertDeepEqual(
  EmailDraft.parseRecipients("", "a@example.com, B Person <b@example.com>"),
  [
    { name: null, email: "a@example.com" },
    { name: "B Person", email: "b@example.com" },
  ],
  "comma separated addresses",
);
test.assertDeepEqual(
  EmailDraft.parseRecipients("Team", "a@example.com; b@example.com"),
  [
    { name: null, email: "a@example.com" },
    { name: null, email: "b@example.com" },
  ],
  "To name only applies to a single address",
);
test.assertDeepEqual(
  EmailDraft.parseRecipients("Jane Smith <jane@example.com>", ""),
  [{ name: "Jane Smith", email: "jane@example.com" }],
  "To can hold the address when Email is missing",
);
test.assertDeepEqual(
  EmailDraft.parseRecipients("Jane", "Janet <jane@example.com>"),
  [{ name: "Janet", email: "jane@example.com" }],
  "name in Email line beats To",
);
test.assertEqual(EmailDraft.parseAddress("not an address"), undefined, "rejects text without @");

test.summary();
