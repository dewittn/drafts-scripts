/**
 * SelectAround Unit Tests
 *
 * Covers which sentence a cursor selects in a paragraph, whole-line selection
 * on list items and headings, and the edges of lines and the draft.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/SelectAround.js");

const test = new TestAssertions("SelectAround");

// The text the action would select with the cursor at a position.
function selectAt(text, position) {
  const selection = SelectAround.around(text, [position, 0]);
  return selection && text.substr(...selection);
}

const paragraph = "First one here. Second one? Third one!";

// --- sentences ---
test.section("sentences");

test.assertEqual(selectAt(paragraph, 3), "First one here.", "selects the first sentence");
test.assertEqual(selectAt(paragraph, 20), "Second one?", "selects a middle sentence");
test.assertEqual(selectAt(paragraph, paragraph.length), "Third one!", "selects the last sentence from the end of the line");
test.assertEqual(selectAt(paragraph, 15), "First one here.", "a cursor in the space after a sentence selects that sentence");
test.assertEqual(selectAt(paragraph, 16), "Second one?", "a cursor at the start of a sentence selects it");
test.assertEqual(selectAt("No end mark here", 4), "No end mark here", "selects a line with no end mark");
test.assertEqual(selectAt("Done.  ", 7), "Done.", "leaves out spaces at the end of the line");
test.assertEqual(
  selectAt('He said "stop." Then left.', 3),
  'He said "stop."',
  "keeps a closing quote with its sentence",
);
test.assertEqual(selectAt("It is **done.** Next.", 3), "It is **done.**", "keeps closing emphasis with its sentence");
test.assertEqual(selectAt("Wait... what? Yes.", 2), "Wait...", "treats an ellipsis as an end mark");
test.assertEqual(selectAt("It costs 3.50 today. Ok.", 5), "It costs 3.50 today.", "doesn't split at a decimal point");
test.assertEqual(selectAt("  Indented text. More.", 4), "Indented text.", "leaves out indentation");
test.assertEqual(selectAt("> Quoted line. More.", 4), "Quoted line.", "leaves out a blockquote marker");

// --- whole lines ---
test.section("whole lines");

test.assertEqual(selectAt("- **Where:** Here. There.", 15), "- **Where:** Here. There.", "selects a whole list item");
test.assertEqual(selectAt("  * nested item", 6), "  * nested item", "selects a whole nested list item");
test.assertEqual(selectAt("1. First step. Then more.", 5), "1. First step. Then more.", "selects a whole numbered item");
test.assertEqual(selectAt("- [ ] a task", 8), "- [ ] a task", "selects a whole task");
test.assertEqual(selectAt("## A heading. Really.", 5), "## A heading. Really.", "selects a whole heading");

// --- lines in a draft ---
test.section("lines in a draft");

const sample = "# Title\n\nOne. Two.\n- item\n";
test.assertDeepEqual(SelectAround.around(sample, [15, 0]), [14, 4], "selects within the cursor's line only");
test.assertDeepEqual(SelectAround.around(sample, [20, 0]), [19, 6], "selects a list item in the middle of a draft");
test.assertEqual(SelectAround.around(sample, [8, 0]), null, "does nothing on a blank line");
test.assertEqual(SelectAround.around(sample, [sample.length, 0]), null, "does nothing on the empty line after a final line break");
test.assertDeepEqual(SelectAround.around(sample, [10, 6]), [9, 4], "uses the start of a selection");

// --- editor ---
test.section("editor");

const fakeEditor = {
  text: "One. Two.",
  selection: [6, 0],
  getText() { return this.text; },
  getSelectedRange() { return this.selection; },
  setSelectedRange(start, length) { this.selection = [start, length]; },
  activate() {},
};
SelectAround.selectInEditor(fakeEditor);
test.assertDeepEqual(fakeEditor.selection, [5, 4], "selects the sentence in the editor");

test.summary();
