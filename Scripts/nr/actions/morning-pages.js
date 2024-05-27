require("nr.js");
const defaultTag = "morning pages";

Draft.prototype.isMorningPage = (tagName = defaultTag) => draft.hasTag(tagName);

function startMorningPages(tagName = defaultTag) {
  // Load default workspace
  const workspace = Workspace.find("default");
  app.applyWorkspace(workspace);

  // Display morning pages prompt
  let p = Prompt.create();
  p.title = "Morning Pages";
  p.message = "Do not over-think Morning Pages\njust write three pages of anything...\nand then do it again tomorrow.";
  p.addButton("Go");
  p.isCancellable = false;
  p.show();

  // Create draft from template
  const template = tagName.replace(" ", "-") + ".md";
  let d = newDraft([tagName], template);
  d.update();

  // Load draft and set cursor position
  d.activate();
  setCursorLocation(d);
}

function saveMorningPages() {
  let actions = ["Send To-do’s to things"];
  if (draft.selectionLength) actions.unshift("New from selection");

  for (const i in actions) {
    action = Action.find(actions[i]);
    app.queueAction(action, draft);
  }

  let d = Draft.find(draft.uuid);
  d.setTemplateTag("journal", "Journal");
  action = Action.find("DayOne");
  app.queueAction(action, d);

  // If running on an iPhone or iPad, open streaks.
  const baseURL = "streaks://x-callback-url/completed/80A47244-0FF2-4F55-919A-D783EF8CF3F2";
  if (device.model != "Mac") openCallback(baseURL);

  draft.trash();
}

if (draft.isMorningPage()) {
  saveMorningPages();
} else {
  startMorningPages();
}
