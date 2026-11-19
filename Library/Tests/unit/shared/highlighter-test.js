/**
 * Highlighter Unit Tests
 *
 * Covers adding a highlight around a selection, removing the one the cursor or
 * selection is in, and that pressing twice puts the text back.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/Highlighter.js");

const test = new TestAssertions("Highlighter");

// Applies a toggle to text and returns the new text and selection, or null.
function press(text, selection) {
  const edit = Highlighter.toggle(text, selection);
  if (!edit) return null;
  const changed = text.slice(0, edit.location) + edit.replacement + text.slice(edit.location + edit.length);
  return { text: changed, selection: edit.selection };
}

// --- adding ---
test.section("adding");

test.assertDeepEqual(
  press("say hello there", [4, 5]),
  { text: "say {==hello==} there", selection: [7, 5] },
  "wraps the selection and keeps it selected",
);
test.assertEqual(press("say hello there", [4, 0]), null, "does nothing with only a cursor outside a highlight");
test.assertDeepEqual(
  press("{==one==} and two", [14, 3]),
  { text: "{==one==} and {==two==}", selection: [17, 3] },
  "wraps a selection outside an existing highlight",
);

// --- removing ---
test.section("removing");

test.assertDeepEqual(
  press("say {==hello==} there", [9, 0]),
  { text: "say hello there", selection: [6, 0] },
  "removes the highlight the cursor is in and keeps the cursor in place",
);
test.assertDeepEqual(
  press("say {==hello==} there", [7, 5]),
  { text: "say hello there", selection: [4, 5] },
  "removes the highlight around a selection inside it",
);
test.assertDeepEqual(
  press("say {==hello==} there", [4, 11]),
  { text: "say hello there", selection: [4, 5] },
  "removes a highlight selected markers and all",
);
test.assertDeepEqual(
  press("say {==hello==} there", [5, 0]),
  { text: "say hello there", selection: [4, 0] },
  "moves a cursor inside the opening marker to the start of the text",
);
test.assertDeepEqual(
  press("say {==hello==} there", [14, 0]),
  { text: "say hello there", selection: [9, 0] },
  "moves a cursor inside the closing marker to the end of the text",
);
test.assertDeepEqual(
  press("{==one==} and {==two==}", [19, 0]),
  { text: "{==one==} and two", selection: [16, 0] },
  "removes only the highlight the cursor is in",
);
test.assertDeepEqual(
  press("{==first\nsecond==}", [10, 0]),
  { text: "first\nsecond", selection: [7, 0] },
  "removes a highlight that spans lines",
);
test.assertDeepEqual(
  press("{==stray and {==real==}", [18, 0]),
  { text: "{==stray and real", selection: [15, 0] },
  "pairs a highlight with its nearest opening marker, not an unclosed one",
);

// --- toggling ---
test.section("toggling");

const once = press("say hello there", [4, 5]);
test.assertDeepEqual(
  press(once.text, once.selection),
  { text: "say hello there", selection: [4, 5] },
  "pressing twice restores the text and selection",
);

test.summary();
