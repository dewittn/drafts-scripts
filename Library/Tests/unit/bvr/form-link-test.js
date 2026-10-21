/**
 * FormLinkStore Unit Tests
 *
 * Covers the shared per-term form links file: validation, which seasons
 * have a term, reading and changing links, and refusing unusable files.
 * Creating a missing file on disk needs Drafts and is not covered here.
 */

require("../Tests/fixtures/assertions.js");
require("modules/cp/filesystems/CloudFS.js");
require("modules/bvr/storage/FormLinkStore.js");

const test = new TestAssertions("FormLinkStore");

// A copy of plain data with a save() that counts calls, standing in for DataFile.
function savable(data) {
  const file = JSON.parse(JSON.stringify(data));
  Object.defineProperty(file, "saves", { value: 0, writable: true, enumerable: false });
  Object.defineProperty(file, "save", {
    value() {
      this.saves++;
    },
    enumerable: false,
  });
  return file;
}

// --- terms ---
test.section("terms");

test.assertEqual(FormLinkStore.termFor("2026-fall"), "2026-fall", "2026-fall is its own term");
test.assertEqual(FormLinkStore.termFor("2026-Winter"), "2026-winter", "case does not matter, and the term is lowercase");
test.assertEqual(FormLinkStore.termFor("2027-spring"), "2027-spring", "2027-spring is a term");
test.assertEqual(FormLinkStore.termFor("2026-27"), undefined, "2026-27 has no term");
test.assertEqual(FormLinkStore.termFor("2026-summer"), undefined, "summer is not a term");
test.assertEqual(FormLinkStore.termFor(2026), undefined, "a bare year (old files) has no term");

// --- validation ---
test.section("validation");

const cases = [
  ["a complete file", { schemaVersion: 1, terms: { "2026-fall": { a: "x" } } }, true],
  ["no terms yet", { schemaVersion: 1, terms: {} }, true],
  ["null (half-synced file)", null, false],
  ["an empty object", {}, false],
  ["unknown schemaVersion", { schemaVersion: 2, terms: {} }, false],
  ["terms an array", { schemaVersion: 1, terms: [] }, false],
  ["a term that is not an object", { schemaVersion: 1, terms: { "2026-fall": "x" } }, false],
];
for (const [name, data, valid] of cases) {
  test.assertEqual(FormLinkStore.validate(data) == undefined, valid, `validate: ${name}`);
}

// --- links ---
test.section("links");

const file = savable({ schemaVersion: 1, terms: {} });
const store = new FormLinkStore(file);
test.assertEqual(store.link("2026-fall", "varsity-score-report"), undefined, "no link before one is set");
store.setLink("2026-fall", "varsity-score-report", "https://docs.google.com/forms/d/e/V");
store.setLink("2026-fall", "ms-score-report", "https://docs.google.com/forms/d/e/M");
store.setLink("2026-winter", "varsity-score-report", "https://docs.google.com/forms/d/e/W");
test.assertDeepEqual(
  file.terms,
  {
    "2026-fall": { "varsity-score-report": "https://docs.google.com/forms/d/e/V", "ms-score-report": "https://docs.google.com/forms/d/e/M" },
    "2026-winter": { "varsity-score-report": "https://docs.google.com/forms/d/e/W" },
  },
  "links are kept per term and per form",
);
store.clearLink("2026-fall", "ms-score-report");
test.assertEqual(store.link("2026-fall", "ms-score-report"), undefined, "clearLink removes one link");
test.assertEqual(store.link("2026-fall", "varsity-score-report"), "https://docs.google.com/forms/d/e/V", "and leaves the others");
test.assertEqual(file.saves, 0, "changes are not written until save");
store.save();
test.assertEqual(file.saves, 1, "save writes once");

const broken = savable({ terms: {} });
test.assertThrows(() => new FormLinkStore(broken).save(), "refuses to save a file that would not load back", "not saved");
test.assertEqual(broken.saves, 0, "nothing was written");

// --- loading ---
test.section("loading");

const loaded = FormLinkStore.load("../Tests/fixtures/bvr/form-links.json");
test.assertEqual(loaded.link("2026-fall", "varsity-score-report"), "https://docs.google.com/forms/d/e/FALL", "loads an existing file");
test.assertThrows(
  () => FormLinkStore.load("../Tests/fixtures/bvr/team-file-half-synced.json"),
  "a half-synced file cannot be loaded",
  "cannot be used",
);

test.summary();
