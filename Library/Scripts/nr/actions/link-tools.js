require("libraries/ActionMenu.js");
// helper to test for URL
function isUrl(s) {
  var regexp =
    /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
  return regexp.test(s);
}

const clipboard = app.getClipboard();
const actionMenu = ActionMenu.createFromGroup("Link Actions");

if (isUrl(clipboard)) {
  actionMenu.selectAction("Markdown Link");
  const clearClipboard = Action.find("Clear Clipboard");
  app.queueAction(clearClipboard, draft);
} else {
  actionMenu.select();
}
