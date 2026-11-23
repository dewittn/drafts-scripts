/**
 * BoldListItems Unit Tests
 *
 * Covers which list items get their leading label bolded. Cases come from the
 * "Test Doc" draft the Bold List Items action was first written against.
 */

require("../Tests/fixtures/assertions.js");
require("modules/nr/BoldListItems.js");

const test = new TestAssertions("BoldListItems");
const bolder = new BoldListItems();
const bolds = (line, expected, message, b = bolder) => test.assertEqual(b.line(line), expected, message);
const leaves = (line, message, b = bolder) => test.assertEqual(b.line(line), line, message);

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
bolds("- Author Update(s): monthly", "- **Author Update(s):** monthly", "keeps parentheses inside a word");
bolds("- Notes (draft): rough", "- **Notes (draft):** rough", "allows a word in parentheses");
bolds("- Coto.Studio: the studio", "- **Coto.Studio:** the studio", "keeps a period inside a word");
bolds("- Coto.Studio. The studio", "- **Coto.Studio.** The studio", "keeps a period inside a name label");
bolds("- iPhone. Apple's phone", "- **iPhone.** Apple's phone", "treats a word with a capital inside as a name");
bolds("- Lord of the Rings. A long book", "- **Lord of the Rings.** A long book", "allows small words inside a name");
bolds("- Waking From Innocent Dreams. My novel", "- **Waking From Innocent Dreams.** My novel", "has no word limit for a name");
bolds("- What I learned from coaching this week: patience", "- **What I learned from coaching this week:** patience", "has no word limit before a colon");

// --- periods after ordinary words ---
test.section("periods after ordinary words");

leaves("- I liked it. A lot.", "skips a sentence followed by another");
leaves("- This is a bullet that should not be matched. More text", "skips a long first sentence");
leaves("- the app. Lowercase start", "skips a lowercase first word");

// --- lines that stay the same ---
test.section("lines that stay the same");

leaves("This is a regular line of text and should not be matched.", "skips a line that is not a list item");
leaves("1. This is a number that should not be matched.", "skips a sentence that ends the item");
leaves("- Ulysses& does a great job", "skips a label ending in an unknown symbol");
leaves("2. **Evernote.** They do a good job", "skips an item that is already bold");
leaves("- __Evernote.__ They do a good job", "skips an item bolded with underscores");
leaves("- Buy milk.", "leaves a short sentence alone instead of bolding all of it");
leaves("- Version 2.5 adds tables", "skips a decimal number");
leaves("- Meeting at 10:30 today", "skips a time");
leaves("- Test to do @tags(Chore, Online)", "skips a Things to-do");
leaves("1. Inciting Incident ^ The Y wants", "skips a caret, which is not a separator");
leaves("-Evernote. No space after the bullet", "needs a space after the bullet");

// --- options ---
test.section("options");

const anyPeriod = new BoldListItems({ periodNamesOnly: false });
bolds("- I liked it. A lot.", "- **I liked it.** A lot.", "bolds any period label when names are not required", anyPeriod);

const colonsOnly = new BoldListItems({ separators: ":" });
leaves("- Evernote. They do", "ignores periods when they are not a separator", colonsOnly);
leaves("2. Complication - the alumni", "ignores dashes when they are not a separator", colonsOnly);
bolds("- Resolution: With this", "- **Resolution:** With this", "still bolds a colon label", colonsOnly);

const twoWords = new BoldListItems({ maxWords: 2 });
bolds("- Turning Point. - there", "- **Turning Point.** - there", "allows a label up to the word limit", twoWords);
leaves("- Waking From Innocent Dreams. My novel", "skips a label over the word limit", twoWords);

// --- whole drafts ---
test.section("whole drafts");

test.assertEqual(
  bolder.text("# Notes\n\n- Evernote. Good.\n- Ulysses. Great."),
  "# Notes\n\n- **Evernote.** Good.\n- **Ulysses.** Great.",
  "bolds every list item and keeps the other lines"
);
test.assertEqual(
  bolder.text("```yaml\n- name: Evernote\n```\n- Things: Cultured Code"),
  "```yaml\n- name: Evernote\n```\n- **Things:** Cultured Code",
  "leaves list items inside fenced code alone"
);

test.summary();
