/**
 * LineMover Unit Tests
 *
 * Covers which lines a cursor or selection moves, the edges of the draft, and
 * that pressing again keeps moving the same lines (the bug in the old script).
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/LineMover.js");

const test = new TestAssertions("LineMover");

const sample = "one\ntwo\nthree\nfour\n";

// Applies a move to text and returns the new text and selection, or null.
function press(text, selection, direction) {
  const edit = LineMover.move(text, selection, direction);
  if (!edit) return null;
  const moved = text.slice(0, edit.location) + edit.replacement + text.slice(edit.location + edit.length);
  return { text: moved, selection: edit.selection };
}

// Presses the action several times in a row, like a repeated shortcut.
function pressRepeatedly(text, selection, direction, times) {
  let state = { text, selection };
  for (let i = 0; i < times; i++) state = press(state.text, state.selection, direction) || state;
  return state;
}

const selectedText = ({ text, selection: [start, length] }) => text.substr(start, length);

// --- cursor ---
test.section("cursor");

test.assertDeepEqual(
  press(sample, [10, 0], "up"),
  { text: "one\nthree\ntwo\nfour\n", selection: [6, 0] },
  "moves the cursor's line up and keeps the cursor in it",
);
test.assertDeepEqual(
  press(sample, [10, 0], "down"),
  { text: "one\ntwo\nfour\nthree\n", selection: [15, 0] },
  "moves the cursor's line down",
);
test.assertDeepEqual(
  press(sample, [13, 0], "up"),
  { text: "one\nthree\ntwo\nfour\n", selection: [9, 0] },
  "a cursor at the end of a line moves that line",
);
test.assertEqual(press(sample, [2, 0], "up"), null, "the first line cannot move up");
test.assertEqual(press(sample, [16, 0], "down"), null, "the last line cannot move down");
test.assertEqual(press(sample, [19, 0], "up"), null, "the empty spot after the final line break is not a line");

// --- selection ---
test.section("selection");

test.assertDeepEqual(
  press(sample, [5, 6], "up"),
  { text: "two\nthree\none\nfour\n", selection: [1, 6] },
  "moves every line the selection touches and keeps the selection",
);
test.assertDeepEqual(
  press(sample, [8, 6], "up"),
  { text: "one\nthree\ntwo\nfour\n", selection: [4, 6] },
  "a selection ending just after a line break leaves the next line alone",
);
test.assertDeepEqual(
  press(sample, [8, 6], "down"),
  { text: "one\ntwo\nfour\nthree\n", selection: [13, 6] },
  "the same selection moves only its own line down",
);
test.assertDeepEqual(
  press(sample, [14, 5], "up"),
  { text: "one\ntwo\nfour\nthree\n", selection: [8, 5] },
  "a selection ending at the end of the draft moves its line",
);
test.assertEqual(press(sample, [14, 5], "down"), null, "that selection cannot move down");

// --- no final line break ---
test.section("no final line break");

test.assertDeepEqual(
  press("one\ntwo\nthree", [10, 0], "up"),
  { text: "one\nthree\ntwo", selection: [6, 0] },
  "moves the last line up without adding a line break",
);
test.assertDeepEqual(
  press("one\ntwo\nthree", [5, 0], "down"),
  { text: "one\nthree\ntwo", selection: [11, 0] },
  "moves a line down past the last line",
);

// --- blank lines ---
test.section("blank lines");

test.assertDeepEqual(
  press("one\n\nthree\n", [5, 0], "up"),
  { text: "one\nthree\n\n", selection: [4, 0] },
  "swaps with a blank line",
);
test.assertDeepEqual(
  press("one\n\nthree\n", [4, 0], "up"),
  { text: "\none\nthree\n", selection: [0, 0] },
  "moves a blank line",
);

// --- repeated presses ---
test.section("repeated presses");

let state = pressRepeatedly("a\nb\nc\nd\ne\nf\n", [8, 3], "up", 3);
test.assertEqual(state.text, "a\ne\nf\nb\nc\nd\n", "a two-line selection moves three lines up as a pair");
test.assertEqual(selectedText(state), "e\nf", "the selection still holds the same two lines");

state = pressRepeatedly("a\nb\nc\nd\ne\nf\n", [8, 2], "up", 3);
test.assertEqual(state.text, "a\ne\nb\nc\nd\nf\n", "a selection ending after a line break moves one line, every press");
test.assertEqual(selectedText(state), "e\n", "and never grows");

state = pressRepeatedly("a\nb\nc\n", [4, 0], "up", 5);
test.assertEqual(state.text, "c\na\nb\n", "stops at the top");

state = pressRepeatedly("a\nb\nc", [0, 1], "down", 5);
test.assertEqual(state.text, "b\nc\na", "stops at the bottom without a final line break");
test.assertEqual(selectedText(state), "a", "keeps the selection at the bottom");

// --- editor ---
test.section("editor");

const fakeEditor = {
  text: sample,
  selection: [10, 0],
  getText() { return this.text; },
  getSelectedRange() { return this.selection; },
  setTextInRange(location, length, text) {
    this.text = this.text.slice(0, location) + text + this.text.slice(location + length);
  },
  setSelectedRange(location, length) { this.selection = [location, length]; },
};
LineMover.moveInEditor(fakeEditor, "up");
test.assertEqual(fakeEditor.text, "one\nthree\ntwo\nfour\n", "edits the editor's text");
test.assertDeepEqual(fakeEditor.selection, [6, 0], "sets the editor's selection");
LineMover.moveInEditor(fakeEditor, "up");
LineMover.moveInEditor(fakeEditor, "up");
test.assertEqual(fakeEditor.text, "three\none\ntwo\nfour\n", "leaves the editor alone at the top");

test.summary();
