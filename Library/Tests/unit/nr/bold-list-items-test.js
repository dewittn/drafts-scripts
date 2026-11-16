/**
 * BoldListItems Unit Tests
 *
 * Covers which list items get their leading label bolded. Cases come from the
 * "Test Doc" draft the Bold List Items action was first written against.
 */

require("../Tests/fixtures/assertions.js");
require("modules/nr/BoldListItems.js");

const test = new TestAssertions("BoldListItems");
const bolds = (line, expected, message) => test.assertEqual(BoldListItems.line(line), expected, message);
const leaves = (line, message) => test.assertEqual(BoldListItems.line(line), line, message);

// --- labels that change ---
test.section("labels that change");

bolds("- Evernote. They do a good job", "- **Evernote.** They do a good job", "bolds a one-word label on a bullet");
bolds("1. Ulysses. does a great job", "1. **Ulysses.** does a great job", "bolds a label on a numbered item");
bolds("126. Resolution: With this data", "126. **Resolution:** With this data", "bolds a colon label after a long number");
bolds("- 1Password. I hope", "- **1Password.** I hope", "allows a label that starts with a digit");
bolds("1. Inciting Incident: The Y wants", "1. **Inciting Incident:** The Y wants", "bolds a two-word label");
bolds("2. Complication - the alumni base", "2. **Complication** - the alumni base", "bolds the words before a dash");
bolds("3. Turning Point. - there might be", "3. **Turning Point.** - there might be", "prefers the period over a later dash");
bolds("- Crisis — it has benefits", "- **Crisis** — it has benefits", "treats an em dash as a separator");
bolds("* Things. Though their updates", "* **Things.** Though their updates", "bolds a \"* \" bullet");
bolds("+ Trello. While I don't", "+ **Trello.** While I don't", "bolds a \"+ \" bullet");
bolds("\t- Nested. Under another item", "\t- **Nested.** Under another item", "bolds an indented bullet");
bolds("1) Climax: Crowdfunding will", "1) **Climax:** Crowdfunding will", "bolds a \"1)\" numbered item");
bolds("- Cultured Code's app: Things", "- **Cultured Code's app:** Things", "keeps apostrophes inside a label");
bolds("- Bogotá: the capital", "- **Bogotá:** the capital", "matches accented letters");
bolds("- Goals:", "- **Goals:**", "bolds a colon label that heads a sub-list");

// --- lines that stay the same ---
test.section("lines that stay the same");

leaves("This is a regular line of text and should not be matched.", "skips a line that is not a list item");
leaves("1. This is a number that should not be matched.", "skips an item with no label in its first five words");
leaves("- Ulysses& does a great job", "skips a label ending in an unknown symbol");
leaves("2. **Evernote.** They do a good job", "skips an item that is already bold");
leaves("- __Evernote.__ They do a good job", "skips an item bolded with underscores");
leaves("- Buy milk.", "leaves a short sentence alone instead of bolding all of it");
leaves("- Version 2.5 adds tables", "skips a decimal number");
leaves("- Meeting at 10:30 today", "skips a time");
leaves("- Test to do @tags(Chore, Online)", "skips a Things to-do");
leaves("1. Inciting Incident ^ The Y wants", "skips a caret, which is not a separator");
leaves("-Evernote. No space after the bullet", "needs a space after the bullet");

// --- whole drafts ---
test.section("whole drafts");

test.assertEqual(
  BoldListItems.text("# Notes\n\n- Evernote. Good.\n- Ulysses. Great."),
  "# Notes\n\n- **Evernote.** Good.\n- **Ulysses.** Great.",
  "bolds every list item and keeps the other lines"
);
test.assertEqual(
  BoldListItems.text("```yaml\n- name: Evernote\n```\n- Things: Cultured Code"),
  "```yaml\n- name: Evernote\n```\n- **Things:** Cultured Code",
  "leaves list items inside fenced code alone"
);

test.summary();
