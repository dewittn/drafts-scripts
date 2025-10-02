require("../Scripts/modules/cp/contentPipline.js");

const cp = new ContentPipeline();
const link = cp.getPublishedPostURL();

app.setClipboard(link);

if (draft.selectionLength > 0) {
  nextAction = Action.find("Markdown Link");
  app.queueAction(nextAction, draft);
}
