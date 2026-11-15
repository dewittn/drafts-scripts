/**
 * BearNote and Bear.readNote() Unit Tests
 *
 * BearNote wraps Bear's x-success replies, which come in different shapes:
 * - open-note: note (the text), identifier, title, tags as a JSON array in
 *   a string, is_trashed "yes"/"no"
 * - create: identifier and title only
 * - search: one { note: "<JSON>" } per result (see Bear.search())
 * readNote() is checked with a stub CallbackURL; it has not been run
 * against Bear itself.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/bear.js");

const test = new TestAssertions("BearNote");

const openNoteReply = {
  note: "# Book Review\n\nNotes here #Pipeline",
  identifier: "NOTE-1",
  title: "Book Review",
  tags: '["Pipeline","book review","Drafting"]',
  is_trashed: "no",
  modificationDate: "2026-11-15T21:00:00Z",
  creationDate: "2026-11-01T09:00:00Z",
};

test.section("open-note reply");
let note = new BearNote(openNoteReply);
test.assertEqual(note.identifier, "NOTE-1", "reads the identifier");
test.assertEqual(note.title, "Book Review", "reads the title");
test.assertEqual(note.text, openNoteReply.note, "reads the text from note");
test.assertDeepEqual(note.tags, ["Pipeline", "book review", "Drafting"], "parses tags from the JSON string");
test.assertEqual(note.isTrashed, false, "reads is_trashed");
test.assertEqual(new BearNote({ ...openNoteReply, is_trashed: "yes" }).isTrashed, true, "is_trashed yes is true");

test.section("hasTag");
test.assertEqual(note.hasTag("Pipeline"), true, "finds a tag");
test.assertEqual(note.hasTag("#pipeline"), true, "ignores case and a leading #");
test.assertEqual(note.hasTag("Book Review"), true, "matches a tag with a space");
test.assertEqual(note.hasTag("Editing"), false, "misses a tag the note does not have");

test.section("Other reply shapes");
note = new BearNote({ identifier: "NOTE-2", title: "New Note" });
test.assertDeepEqual(note.tags, [], "a create reply has no tags");
test.assertEqual(note.hasTag("Pipeline"), false, "hasTag is false with no tags");
test.assertEqual(note.text, undefined, "a create reply has no text");

note = new BearNote({ note: JSON.stringify({ identifier: "NOTE-3", title: "Found", pin: "yes", tags: ["a", "b"] }) });
test.assertEqual(note.identifier, "NOTE-3", "unpacks a search result");
test.assertEqual(note.isPinned, true, "reads pin");
test.assertDeepEqual(note.tags, ["a", "b"], "keeps a tags array as is");

note = new BearNote('{"identifier":"NOTE-4","title":"From JSON"}');
test.assertEqual(note.title, "From JSON", "parses a JSON string");

note = new BearNote({ identifier: "NOTE-5", tags: "one, two" });
test.assertDeepEqual(note.tags, ["one", "two"], "splits a plain comma list");

test.section("Bear.readNote()");
let opened = [];
/** @type {any} */ (globalThis).CallbackURL = {
  create: () => {
    const cb = { params: {}, waitForResponse: true, callbackResponse: openNoteReply };
    cb.addParameter = (key, value) => (cb.params[key] = value);
    cb.open = () => {
      opened.push(cb);
      return true;
    };
    return cb;
  },
};

note = Bear.create().readNote("NOTE-1");
test.assertEqual(opened.length, 1, "makes one call");
test.assertEqual(opened[0].baseURL, "bear://x-callback-url/open-note", "calls open-note, not grab-url");
test.assertEqual(opened[0].waitForResponse, true, "waits for the reply");
test.assertEqual(opened[0].params.show_window, "no", "does not show Bear's window");
test.assertEqual(opened[0].params.open_note, "no", "does not open the note");
test.assertEqual(note.title, "Book Review", "returns the note as a BearNote");

test.summary();
