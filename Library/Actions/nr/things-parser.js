require("shared/libraries/DraftsUI.js");
require("shared/libraries/MustachePrompt.js");
require("modules/nr/ThingsParser.js");

// Sends the draft's TaskPaper outline to Things. Asks for any {{variables}}
// first, then fills in Drafts [[tags]]. Items to Pack and BVR's Team class
// queue this action by name, so it must stay "Things Parser".
function thingsParser() {
  const text = new MustachePrompt(new DraftsUI(), { title: "Things Parser" }).render(draft.content);
  if (text == null) return context.cancel();

  const parser = new ThingsParser();
  const items = parser.parse(draft.processTemplate(text));
  if (items.length == 0) return context.cancel("No projects or to-dos to send to Things");

  parser.open(items);
}

thingsParser();
