/**
 * MarkdownEmphasis Unit Tests
 *
 * Covers bolding and italicizing a selection, inserting and removing an empty
 * pair, removing the style the cursor is in (with asterisks or underscores),
 * taking one style off text that has both, finding italics inside bold,
 * leaving snake_case alone, and that pressing twice puts the text back.
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
  { text: "say _hello_ there", selection: [5, 5] },
  "italicizes the selection with underscores and keeps it selected",
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
  press("say  there", [4, 0], "italic"),
  { text: "say __ there", selection: [5, 0] },
  "inserts an empty pair at a cursor outside italics",
);
test.assertDeepEqual(
  press("say _hello_ there", [5, 5]),
  { text: "say _**hello**_ there", selection: [7, 5] },
  "bolds italic text",
);
test.assertDeepEqual(
  press("say **hello** there", [6, 5], "italic"),
  { text: "say **_hello_** there", selection: [7, 5] },
  "italicizes bold text",
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
  { text: "say hello there", selection: [4, 5] },
  "removes the bold the cursor is in and selects the text",
);
test.assertDeepEqual(
  press("say _hello_ there", [7, 0], "italic"),
  { text: "say hello there", selection: [4, 5] },
  "removes the italics the cursor is in and selects the text",
);
test.assertDeepEqual(
  press("say *hello* there", [7, 0], "italic"),
  { text: "say hello there", selection: [4, 5] },
  "removes italics written with asterisks",
);
test.assertDeepEqual(
  press("say __hello__ there", [8, 0]),
  { text: "say hello there", selection: [4, 5] },
  "removes bold written with underscores",
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
  press("say __there", [5, 0], "italic"),
  { text: "say there", selection: [4, 0] },
  "removes an empty italics pair the cursor is in",
);
test.assertDeepEqual(
  press("say ***hello*** there", [9, 0]),
  { text: "say *hello* there", selection: [5, 5] },
  "takes only the bold off bold italics",
);
test.assertDeepEqual(
  press("say ***hello*** there", [9, 0], "italic"),
  { text: "say **hello** there", selection: [6, 5] },
  "takes only the italics off bold italics",
);
test.assertDeepEqual(
  press("say _**hello**_ there", [9, 0]),
  { text: "say _hello_ there", selection: [5, 5] },
  "takes only the bold off bold inside italics",
);
test.assertDeepEqual(
  press("say _**hello**_ there", [9, 0], "italic"),
  { text: "say **hello** there", selection: [4, 9] },
  "takes only the italics off bold inside italics, selecting the bold text",
);
test.assertDeepEqual(
  press("**a _b_ c**", [5, 0], "italic"),
  { text: "**a b c**", selection: [4, 1] },
  "finds italics inside bold",
);
test.assertDeepEqual(
  press("*a **b** c*", [5, 0], "italic"),
  { text: "a **b** c", selection: [0, 9] },
  "finds italics around bold",
);
test.assertDeepEqual(
  press("**one** and **two**", [15, 0]),
  { text: "**one** and two", selection: [12, 3] },
  "removes only the bold the cursor is in",
);
test.assertDeepEqual(
  press("my snake_case_name", [10, 0], "italic"),
  { text: "my snake_c__ase_name", selection: [11, 0] },
  "doesn't take underscores inside a word for italics",
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
