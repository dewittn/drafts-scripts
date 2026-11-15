/**
 * RecentRecords Unit Tests: matching entries by document ID
 *
 * Entries come in three formats: fields.docID (current), fields.DraftsID,
 * and fields.UlyssesID (older). delete() and save() must match all three by
 * document ID. Matching on the record ID missed documents opened from a
 * menu, which have none, and let save() drop every other entry without one.
 */

require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/mocks.js");
require("modules/cp/core/RecentRecords.js");

const test = new TestAssertions("RecentRecords document ID matching");

// A RecentRecords for table "Test Table" holding the given entries. The
// stub file system keeps the last write.
function recentWith(entries) {
  const fs = { read: () => ({ "Test Table": entries }), write: (name, data) => (fs.written = data) };
  return new RecentRecords({
    ui: createMockUI(),
    fileSystem: fs,
    tableName: "Test Table",
    settings: { recentDocsFile: "recentRecords.json" },
  });
}

const titlesOf = (recent) => recent.records.map((record) => record.fields.Title);

const entries = () => [
  { id: 64, fields: { Title: "Current format", docID: "draft-1", docIDType: "DraftsID" } },
  { fields: { Title: "Older Drafts format", DraftsID: "draft-2" } },
  { fields: { Title: "Older Ulysses format", UlyssesID: "sheet-3" } },
  { fields: { Title: "No record ID", docID: "draft-4", docIDType: "DraftsID" } },
];

test.section("delete()");
let recent = recentWith(entries());
recent.delete({ docID: "draft-2" });
test.assertDeepEqual(titlesOf(recent), ["Current format", "Older Ulysses format", "No record ID"], "removes an entry stored as DraftsID");

recent = recentWith(entries());
recent.delete({ docID: "sheet-3" });
test.assertDeepEqual(titlesOf(recent), ["Current format", "Older Drafts format", "No record ID"], "removes an entry stored as UlyssesID");

recent = recentWith(entries());
recent.delete({ docID: "draft-1" });
test.assertDeepEqual(titlesOf(recent), ["Older Drafts format", "Older Ulysses format", "No record ID"], "removes a current entry with no record ID on the doc");

test.section("save()");
recent = recentWith(entries());
recent.save({
  title: "Older Drafts format",
  scrubedTitle: "Saved again",
  recordID: undefined,
  docID: "draft-2",
  docIDType: "DraftsID",
  destination: "Inbox",
  status: "Drafting",
});
test.assertDeepEqual(
  titlesOf(recent),
  ["Saved again", "Current format", "Older Ulysses format", "No record ID"],
  "replaces the earlier entry for the same document and keeps the others"
);

test.summary();
