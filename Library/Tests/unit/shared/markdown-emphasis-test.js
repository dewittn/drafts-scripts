/**
 * MarkdownEmphasis Unit Tests
 *
 * Covers bolding and italicizing a selection, inserting and removing an empty
 * pair, removing the style the cursor is in, taking one style off ***both***,
 * finding italics inside bold, and that pressing twice puts the text back.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/MarkdownEmphasis.js");

const test = new TestAssertions("MarkdownEmphasis");

// Applies a toggle to text and returns the new text and selection.
function press(text, selection, style = "bold") {
  const edit = MarkdownEmphasis.toggle(text, selection, style);
  const changed = text.slice(0, edit.location) + edit.replacement + text.slice(edit.location + edit.length);
  return { text: changed, selection: edit.selection };
}

// --- adding emphasis ---
test.section("adding emphasis");

test.assertDeepEqual(
  press("say hello there", [4, 5]),
  { text: "say **hello** there", selection: [6, 5] },
  "bolds the selection and keeps it selected",
);
test.assertDeepEqual(
  press("say hello there", [4, 5], "italic"),
  { text: "say *hello* there", selection: [5, 5] },
  "italicizes the selection and keeps it selected",
);
test.assertDeepEqual(
  press("say hello there", [4, 6]),
  { text: "say **hello** there", selection: [6, 5] },
  "leaves a trailing space outside the asterisks",
);
test.assertDeepEqual(
  press("say  there", [4, 0]),
  { text: "say **** there", selection: [6, 0] },
  "inserts an empty pair at a cursor outside bold",
);
test.assertDeepEqual(
  press("say *hello* there", [5, 5]),
  { text: "say ***hello*** there", selection: [7, 5] },
  "bolds italic text",
);
test.assertDeepEqual(
  press("* item and *more", [7, 3]),
  { text: "* item **and** *more", selection: [9, 3] },
  "ignores a list bullet and an unclosed asterisk",
);

// --- removing emphasis ---
test.section("removing emphasis");

test.assertDeepEqual(
  press("say **hello** there", [8, 0]),
  { text: "say hello there", selection: [6, 0] },
  "removes the bold the cursor is in",
);
test.assertDeepEqual(
  press("say *hello* there", [7, 0], "italic"),
  { text: "say hello there", selection: [6, 0] },
  "removes the italics the cursor is in",
);
test.assertDeepEqual(
  press("say **hello** there", [4, 9]),
  { text: "say hello there", selection: [4, 5] },
  "removes bold selected asterisks and all",
);
test.assertDeepEqual(
  press("say ****there", [6, 0]),
  { text: "say there", selection: [4, 0] },
  "removes an empty pair the cursor is in",
);
test.assertDeepEqual(
  press("say ***hello*** there", [9, 0]),
  { text: "say *hello* there", selection: [7, 0] },
  "takes only the bold off bold italics",
);
test.assertDeepEqual(
  press("say ***hello*** there", [9, 0], "italic"),
  { text: "say **hello** there", selection: [8, 0] },
  "takes only the italics off bold italics",
);
test.assertDeepEqual(
  press("**a *b* c**", [5, 0], "italic"),
  { text: "**a b c**", selection: [4, 0] },
  "finds italics inside bold",
);
test.assertDeepEqual(
  press("*a **b** c*", [5, 0], "italic"),
  { text: "a **b** c", selection: [4, 0] },
  "finds italics around bold",
);
test.assertDeepEqual(
  press("**one** and **two**", [15, 0]),
  { text: "**one** and two", selection: [13, 0] },
  "removes only the bold the cursor is in",
);

// --- toggling ---
test.section("toggling");

for (const style of ["bold", "italic"]) {
  const once = press("say hello there", [4, 5], style);
  test.assertDeepEqual(
    press(once.text, once.selection, style),
    { text: "say hello there", selection: [4, 5] },
    `pressing ${style} twice restores the text and selection`,
  );
}

test.summary();
