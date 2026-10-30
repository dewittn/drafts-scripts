/**
 * MarkdownSections Unit Tests
 *
 * Covers where a section ends at each heading level and removing a section.
 * Game report use is covered in unit/bvr/edit-game-test.js.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/MarkdownSections.js");

const test = new TestAssertions("MarkdownSections");

const lines = ["# Title", "## Agenda", "a", "### Goals", "b", "### To-Dos", "c", "#### Detail", "d", "### Later", "e", "## Thoughts", "f"];

// --- section bodies ---
test.section("section bodies");

test.assertDeepEqual(MarkdownSections.body(lines, "### To-Dos"), ["c", "#### Detail", "d"], "ends a section at the next heading of its level");
test.assertDeepEqual(MarkdownSections.body(lines, "### Later"), ["e"], "ends a section at a higher-level heading");
test.assertDeepEqual(
  MarkdownSections.body(lines, "## Agenda"),
  ["a", "### Goals", "b", "### To-Dos", "c", "#### Detail", "d", "### Later", "e"],
  "keeps lower-level headings inside a section"
);
test.assertEqual(MarkdownSections.body(lines, "### Missing"), undefined, "returns undefined for a missing heading");
test.assertDeepEqual(MarkdownSections.body(["## A", "#hashtag line", "## B"], "## A"), ["#hashtag line"], "does not take #words for headings");

// --- removing a section ---
test.section("removing a section");

test.assertDeepEqual(
  MarkdownSections.removeSection(lines, "### To-Dos"),
  ["# Title", "## Agenda", "a", "### Goals", "b", "### Later", "e", "## Thoughts", "f"],
  "removes the heading and its body"
);
test.assertDeepEqual(MarkdownSections.removeSection(lines, "### Missing"), lines, "leaves the lines alone when the heading is missing");

test.summary();
