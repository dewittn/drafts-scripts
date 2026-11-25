/**
 * Markdown XL Conversion Unit Tests
 *
 * Covers TextUtilities.convertMarkdown, which turns CriticMarkup into the
 * Markdown XL that Ulysses reads.
 */

require("../Tests/fixtures/assertions.js");
require("modules/cp/utils/TextUtilities.js");

const test = new TestAssertions("Markdown XL conversion");
const textUtils = new TextUtilities();
const convert = (text) => textUtils.convertMarkdown(text);

test.section("highlights");
test.assertEqual(convert("say {== hello ==} there"), "say ::hello:: there", "padded highlight becomes ::");
test.assertEqual(convert("say {==hello==} there"), "say ::hello:: there", "unpadded highlight becomes ::");
test.assertEqual(convert("{==  ==}"), "", "empty highlight is removed");

test.section("comments");
test.assertEqual(convert("a {>> check this <<} b"), "a ++check this++ b", "comment becomes ++");
test.assertEqual(convert("a {>>check this<<} b"), "a ++check this++ b", "unpadded comment becomes ++");

test.section("deletions");
test.assertEqual(convert("keep {-- drop --} here"), "keep ||drop|| here", "deletion becomes ||");

test.section("additions");
test.assertEqual(convert("a {++ new words ++} b"), "a new words b", "addition keeps its text and drops the mark");

test.section("substitutions");
test.assertEqual(convert("{~~ old ~> new ~~}"), "new", "substitution keeps only the new text");
test.assertEqual(convert("{~~old~>new~~}"), "new", "unpadded substitution keeps only the new text");
test.assertEqual(convert("{~~ old ~> ~~}"), "", "substitution with no new text is removed");
test.assertEqual(convert("{~~ plain ~~}"), "plain", "substitution without ~> keeps its text");

test.section("several marks");
test.assertEqual(
  convert("{== one ==} and {>> note <<} and {-- two --}"),
  "::one:: and ++note++ and ||two||",
  "converts each mark in one line",
);
test.assertEqual(
  convert("{== one\n{== two ==}"),
  "{== one\n::two::",
  "an unclosed mark does not swallow the next one",
);

test.section("text without marks");
test.assertEqual(convert("plain ++ text ++ and :: text ::"), "plain ++ text ++ and :: text ::", "existing Markdown XL is left alone");
test.assertEqual(convert(""), "", "empty text stays empty");

test.summary();
