/**
 * BearSender Unit Tests
 *
 * Covers the Bear: New & File and Bear: New & Return flow with a stub Bear
 * client, a stub draft, and a stub template reader.
 */

require("../Tests/fixtures/assertions.js");

// Stubbed before the require so BearSender's guard skips loading nr.js.
let templatesRead = [];
/** @type {any} */ (globalThis).fetchTemplate = (name) => {
  templatesRead.push(name);
  return "TEMPLATE";
};
require("modules/nr/BearSender.js");

const test = new TestAssertions("BearSender");

// Records each create call. Set error to make Bear report a failure.
/** @returns {any} */
function makeBear({ error = false } = {}) {
  return {
    calls: [],
    error,
    create(title, text, tags, options) {
      this.calls.push({ title, text, tags, options });
    },
  };
}

// A draft that renders templates as "<template>|<bearTags>|<content>".
/** @returns {any} */
function makeDraft({ tags = [], content = "Body" } = {}) {
  return {
    tags,
    content,
    isTrashed: false,
    updates: 0,
    templateTags: {},
    setTemplateTag(name, value) {
      this.templateTags[name] = value;
    },
    processTemplate(template) {
      return `${template}|${this.templateTags.bearTags}|${this.content}`;
    },
    update() {
      this.updates++;
    },
  };
}

test.section("sendAndStay");

let bear = makeBear();
let d = makeDraft({ tags: ["work", "big idea"], content: "See [[bear:Other Note]]" });
let result = new BearSender(bear).sendAndStay("bear-note.md", d);

test.assertEqual(result, true, "returns true when the note is created");
test.assertDeepEqual(templatesRead, ["bear-note.md"], "reads the named template");
test.assertEqual(bear.calls.length, 1, "creates exactly one note");
test.assertEqual(
  bear.calls[0].text,
  "TEMPLATE|#Work #Big Idea# #_inbox|See [[Other Note]]",
  "renders the template with Bear tags and plain wiki links",
);
test.assertDeepEqual(bear.calls[0].options, { returnToDrafts: false }, "opens a plain URL, so Bear stays open");
test.assertEqual(d.isTrashed, true, "trashes the draft");

test.section("sendAndReturn");

bear = makeBear();
d = makeDraft();
result = new BearSender(bear).sendAndReturn("bear-note.md", d);

test.assertEqual(result, true, "returns true when the note is created");
test.assertEqual(bear.calls.length, 1, "creates exactly one note");
test.assertDeepEqual(
  bear.calls[0].options,
  { openNote: "no", showWindow: "no" },
  "creates in the background and waits for x-success to return",
);
test.assertEqual(d.isTrashed, true, "trashes the draft");

test.section("Bear error");

bear = makeBear({ error: true });
d = makeDraft();
result = new BearSender(bear).sendAndReturn("bear-note.md", d);

test.assertEqual(result, false, "returns false when Bear reports an error");
test.assertEqual(d.isTrashed, false, "keeps the draft");

test.summary();
