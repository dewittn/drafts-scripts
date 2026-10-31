require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("shared/libraries/MarkdownSections.js");
require("modules/nr/ThingsParser.js");

// Sends the draft's To-Dos section to Things as Things Parser text, then
// removes the section, heading and all. Lines Things has no place for keep
// the section on the page, with a warning, so nothing typed is lost. Morning
// Pages queues this by name between New from selection and DayOne, so it
// must stay "Send To-do’s to things". The heading is `things.todoHeading` in
// nr-settings.yaml.
function sendTodosToThings() {
  const { todoHeading } = loadSettings("nr-settings.json").things;
  const lines = draft.content.split("\n");
  const todos = MarkdownSections.body(lines, todoHeading)?.join("\n");
  if (todos == undefined) return;

  const parser = new ThingsParser();
  const items = parser.parse(todos);
  if (items.length && !parser.send(items)) {
    context.fail("Things did not add the to-dos");
    return;
  }

  const unsent = parser.unsent(todos);
  if (unsent.length) {
    new DraftsUI().displayWarningMessage(`Not sent to Things, so To-Dos stays on the page: ${unsent.join(", ")}`);
    return;
  }

  // The global draft, since Drafts writes it back when this step ends.
  draft.content = MarkdownSections.removeSection(lines, todoHeading).join("\n");
  draft.update();
}

sendTodosToThings();
