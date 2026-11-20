/**
 * CriticMarkup Unit Tests
 *
 * Covers adding a highlight or comment around a selection, removing the one
 * the cursor or selection is in (padded or not), inserting an empty comment,
 * and that pressing twice puts the text back.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/CriticMarkup.js");

const test = new TestAssertions("CriticMarkup");

// Applies a toggle to text and returns the new text and selection, or null.
function press(text, selection, markName = "highlight") {
  const edit = CriticMarkup.toggle(text, selection, markName);
  if (!edit) return null;
  const changed = text.slice(0, edit.location) + edit.replacement + text.slice(edit.location + edit.length);
  return { text: changed, selection: edit.selection };
}

// --- adding a highlight ---
test.section("adding a highlight");

test.assertDeepEqual(
  press("say hello there", [4, 5]),
  { text: "say {== hello ==} there", selection: [8, 5] },
  "wraps the selection with padding and keeps it selected",
);
test.assertEqual(press("say hello there", [4, 0]), null, "does nothing with only a cursor outside a highlight");
test.assertDeepEqual(
  press("{== one ==} and two", [16, 3]),
  { text: "{== one ==} and {== two ==}", selection: [20, 3] },
  "wraps a selection outside an existing highlight",
);

// --- removing a highlight ---
test.section("removing a highlight");

test.assertDeepEqual(
  press("say {== hello ==} there", [10, 0]),
  { text: "say hello there", selection: [6, 0] },
  "removes a padded highlight and keeps the cursor in place",
);
test.assertDeepEqual(
  press("say {==hello==} there", [9, 0]),
  { text: "say hello there", selection: [6, 0] },
  "removes a highlight written without padding",
);
test.assertDeepEqual(
  press("say {== hello ==} there", [8, 5]),
  { text: "say hello there", selection: [4, 5] },
  "removes the highlight around a selection inside it",
);
test.assertDeepEqual(
  press("say {== hello ==} there", [4, 13]),
  { text: "say hello there", selection: [4, 5] },
  "removes a highlight selected delimiters and all",
);
test.assertDeepEqual(
  press("say {== hello ==} there", [5, 0]),
  { text: "say hello there", selection: [4, 0] },
  "moves a cursor inside the opening delimiter to the start of the text",
);
test.assertDeepEqual(
  press("say {== hello ==} there", [16, 0]),
  { text: "say hello there", selection: [9, 0] },
  "moves a cursor inside the closing delimiter to the end of the text",
);
test.assertDeepEqual(
  press("{== one ==} and {== two ==}", [21, 0]),
  { text: "{== one ==} and two", selection: [17, 0] },
  "removes only the highlight the cursor is in",
);
test.assertDeepEqual(
  press("{== first\nsecond ==}", [11, 0]),
  { text: "first\nsecond", selection: [7, 0] },
  "removes a highlight that spans lines",
);
test.assertDeepEqual(
  press("{== stray and {== real ==}", [21, 0]),
  { text: "{== stray and real", selection: [17, 0] },
  "pairs a highlight with its nearest opening delimiter, not an unclosed one",
);
test.assertEqual(
  press("say {>> note <<} there", [10, 0]),
  null,
  "leaves a comment alone when highlighting with only a cursor",
);

// --- comments ---
test.section("comments");

test.assertDeepEqual(
  press("say hello there", [4, 5], "comment"),
  { text: "say {>> hello <<} there", selection: [8, 5] },
  "turns the selection into a comment",
);
test.assertDeepEqual(
  press("say hello", [9, 0], "comment"),
  { text: "say hello{>>  <<}", selection: [13, 0] },
  "inserts an empty comment at the cursor and puts the cursor inside it",
);
test.assertDeepEqual(
  press("say hello{>>  <<}", [13, 0], "comment"),
  { text: "say hello", selection: [9, 0] },
  "removes an empty comment",
);
test.assertDeepEqual(
  press("{== text ==}{>> why? <<}", [17, 0], "comment"),
  { text: "{== text ==}why?", selection: [13, 0] },
  "removes a comment after a highlight and leaves the highlight",
);

// --- deletions ---
test.section("deletions");

test.assertDeepEqual(
  press("say hello there", [4, 5], "deletion"),
  { text: "say {-- hello --} there", selection: [8, 5] },
  "marks the selection for deletion",
);
test.assertEqual(press("say hello there", [4, 0], "deletion"), null, "does nothing with only a cursor outside a deletion");
test.assertDeepEqual(
  press("say {-- hello --} there", [10, 0], "deletion"),
  { text: "say there", selection: [4, 0] },
  "deletes the marked text and the extra space between words",
);
test.assertDeepEqual(
  press("say {-- hello --} there", [8, 5], "deletion"),
  { text: "say there", selection: [4, 0] },
  "deletes the marked text around a selection inside it",
);
test.assertDeepEqual(
  press("say {-- hello --}.", [10, 0], "deletion"),
  { text: "say.", selection: [3, 0] },
  "drops the space before punctuation",
);
test.assertDeepEqual(
  press("{-- hello --} there", [6, 0], "deletion"),
  { text: "there", selection: [0, 0] },
  "drops the space after a deletion at the start of a line",
);
test.assertDeepEqual(
  press("say {--hello--}", [9, 0], "deletion"),
  { text: "say", selection: [3, 0] },
  "deletes an unpadded deletion at the end of a line",
);
test.assertDeepEqual(
  press("say {== hello ==} there", [10, 0], "deletion"),
  null,
  "leaves a highlight alone",
);

// --- additions ---
test.section("additions");

test.assertDeepEqual(
  press("say hello there", [4, 5], "addition"),
  { text: "say {++ hello ++} there", selection: [8, 5] },
  "marks the selection as an addition",
);
test.assertDeepEqual(
  press("say there", [4, 0], "addition"),
  { text: "say {++  ++}there", selection: [8, 0] },
  "inserts an empty addition at the cursor",
);
test.assertDeepEqual(
  press("say {++ hello ++} there", [10, 0], "addition"),
  { text: "say hello there", selection: [6, 0] },
  "accepts the addition, keeping its text",
);

// --- substitutions ---
test.section("substitutions");

test.assertDeepEqual(
  press("say hello there", [4, 5], "substitution"),
  { text: "say {~~ hello ~>  ~~} there", selection: [17, 0] },
  "wraps the selection as the old text and puts the cursor where the new text goes",
);
test.assertEqual(press("say hello there", [4, 0], "substitution"), null, "does nothing with only a cursor outside a substitution");
test.assertDeepEqual(
  press("say {~~ hello ~> howdy ~~} there", [18, 0], "substitution"),
  { text: "say howdy there", selection: [4, 5] },
  "accepts the substitution and selects the new text",
);
test.assertDeepEqual(
  press("say {~~hello~>howdy~~} there", [8, 0], "substitution"),
  { text: "say howdy there", selection: [4, 5] },
  "accepts an unpadded substitution",
);
test.assertDeepEqual(
  press("say {~~ hello ~>  ~~} there", [17, 0], "substitution"),
  { text: "say there", selection: [4, 0] },
  "deletes the old text when no new text was written",
);

// --- menu ---
test.section("menu");

test.assertDeepEqual(
  CriticMarkup.menuItems().map(({ data }) => data.name),
  ["Highlight", "Comment", "Addition", "Deletion", "Substitution"],
  "offers a button for every mark",
);
test.assertEqual(CriticMarkup.innermostMarkName("say hello there", [4, 5]), null, "finds no mark outside every mark");
test.assertEqual(
  CriticMarkup.innermostMarkName("say {-- hello --} there", [10, 0]),
  "deletion",
  "finds the mark the cursor is in",
);
test.assertEqual(
  CriticMarkup.innermostMarkName("{== keep {>> note <<} this ==}", [14, 0]),
  "comment",
  "finds the innermost mark when one sits inside another",
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
