require("shared/core/ServiceInitializer.js");
initializeServices();

const cp = ServiceContainer.getInstance().get('cpDefault');
const link = cp.getPublishedPostURL();

app.setClipboard(link);

if (draft.selectionLength > 0) {
  nextAction = Action.find("Markdown Link");
  app.queueAction(nextAction, draft);
}
