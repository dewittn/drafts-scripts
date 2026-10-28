/**
 * DraftsUI Unit Tests
 *
 * Covers showPages() with a stub Prompt and insertAtCursor() with a stub
 * editor. The Things help pages and areas come from nr-settings.yaml.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/DraftsUI.js");

const test = new TestAssertions("DraftsUI");

// Each prompt shown presses the next queued button; null cancels.
let presses = [];
let shown = [];
/** @type {any} */ (globalThis).Prompt = {
  create: () => {
    const prompt = { buttons: [], buttonPressed: undefined };
    prompt.addButton = (name, value, isDefault) => prompt.buttons.push({ name, value, isDefault });
    prompt.show = () => {
      shown.push(prompt);
      prompt.buttonPressed = presses.shift();
      return prompt.buttonPressed != null;
    };
    return prompt;
  },
};

const things = loadRepoYAML("nr-settings.yaml").things;
const pages = [
  { menuTitle: "One", menuMessage: "first" },
  { menuTitle: "Two", menuMessage: "second" },
  { menuTitle: "Three", menuMessage: "third" },
];
const buttonsOf = (prompt) => prompt.buttons.map((button) => button.value);

// --- showPages ---
test.section("showPages");

presses = ["next", "next", "done"];
shown = [];
new DraftsUI().showPages(pages);
test.assertDeepEqual(shown.map((prompt) => prompt.title), ["One", "Two", "Three"], "shows each page in order");
test.assertDeepEqual(buttonsOf(shown[0]), ["next", "done"], "gives a page Next and Done");
test.assertDeepEqual(buttonsOf(shown[2]), ["done"], "gives the last page only Done");
test.assertEqual(shown[2].buttons[0].isDefault, true, "makes Done the default on the last page");

presses = ["done"];
shown = [];
new DraftsUI().showPages(pages);
test.assertEqual(shown.length, 1, "stops at Done");

test.assert(shown.every((prompt) => prompt.isCancellable === false), "shows no Cancel button");

test.assert(
  things.help.length > 1 && things.help.every((page) => page.menuTitle && page.menuMessage),
  "every Things help page has a title and a message"
);
test.assertDeepEqual(
  things.areas,
  ["Sanity", "Personal", "Authoring", "BVR Coaching", "Cabin 23", "Coto.Studio"],
  "lists the Things areas"
);

// --- insertAtCursor ---
test.section("insertAtCursor");

function makeEditor(text, start, length = 0) {
  const stub = { text, range: [start, length], activated: false };
  stub.getSelectedRange = () => stub.range;
  stub.getTextInRange = (location, count) => stub.text.slice(location, location + count);
  stub.setSelectedText = (insert) => {
    const [from, size] = stub.range;
    stub.text = stub.text.slice(0, from) + insert + stub.text.slice(from + size);
  };
  stub.setSelectedRange = (location, count) => (stub.range = [location, count]);
  stub.activate = () => (stub.activated = true);
  /** @type {any} */ (globalThis).editor = stub;
  return stub;
}

let stub = makeEditor("- Clean gutters", 15);
new DraftsUI().insertAtCursor("@area(Sanity)");
test.assertEqual(stub.text, "- Clean gutters @area(Sanity)", "adds a space after other text");
test.assertDeepEqual(stub.range, [29, 0], "leaves the cursor after the insert");
test.assertEqual(stub.activated, true, "returns focus to the editor");

stub = makeEditor("- Clean gutters ", 16);
new DraftsUI().insertAtCursor("@area(Sanity)");
test.assertEqual(stub.text, "- Clean gutters @area(Sanity)", "adds no space after a space");

stub = makeEditor("", 0);
new DraftsUI().insertAtCursor("@area(Sanity)");
test.assertEqual(stub.text, "@area(Sanity)", "adds no space at the start of the draft");

stub = makeEditor("- Task @area(Personal)", 7, 15);
new DraftsUI().insertAtCursor("@area(Sanity)");
test.assertEqual(stub.text, "- Task @area(Sanity)", "replaces the selection");

test.summary();
