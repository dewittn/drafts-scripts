/**
 * Shared stand-ins for the BVR unit tests.
 *
 * mockBVRUI() answers prompts like MockUI, with settings read from the real
 * Library/Data/bvr/ui.yaml, so renaming a key there fails the tests that use
 * it. savable() and fakeDraft() stand in for a DataFile and a Draft, counting
 * saves.
 */

if (typeof MockUI == "undefined") require("../Tests/fixtures/mocks.js");

// Library/Data/bvr/ui.yaml as committed (it has no .yaml.tpl and no PII).
// Run through Eval Draft inside Drafts, where the test runner's loader is
// missing, the built ui.json is read instead.
const bvrUISettings = typeof loadRepoYAML != "undefined"
  ? loadRepoYAML("bvr/ui.yaml")
  : FileManager.createCloud().readJSON("/Library/Data/bvr/ui.json");

// A MockUI with ui.yaml behind settings(). Each call returns a copy; the one
// test that needs DraftsUI's shared object replaces settings itself.
// yesNo: answers to yesNoPrompt by menu title ("yes" or "no"); unlisted is "no".
function mockBVRUI(promptResponses = {}, yesNo = {}) {
  /** @type {any} */
  const ui = new MockUI({ promptResponses });
  ui.settings = (name) => {
    const section = bvrUISettings[name];
    return section == undefined ? undefined : JSON.parse(JSON.stringify(section));
  };
  ui.yesNoPrompt = (menuSettings) => {
    ui.interactions.push({ type: "yesNo", menuSettings });
    return yesNo[menuSettings.menuTitle] || "no";
  };
  return ui;
}

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

// A draft as Drafts has it: content, lines, and update() counted.
function fakeDraft(uuid, content) {
  return {
    uuid,
    content,
    updates: 0,
    get lines() {
      return this.content.split("\n");
    },
    append(text) {
      this.content = `${this.content}\n${text}`;
    },
    update() {
      this.updates++;
    },
  };
}
