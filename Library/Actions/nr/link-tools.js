require("shared/libraries/ActionMenu.js");
// helper to test for URL
function isUrl(s) {
  var regexp =
    /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
  return regexp.test(s);
}

function main() {
  const selected = editor.getSelectedText();
  const clipboard = app.getClipboard();
  const actionMenu = ActionMenu.createFromGroup("Link Actions");

  if (isUrl(selected)) return actionMenu.selectAction("Insert Website Title");

  if (isUrl(clipboard)) {
    actionMenu.selectAction("Markdown Link");
    const clearClipboard = Action.find("Clear Clipboard");
    app.queueAction(clearClipboard, draft);
    return;
  }

  actionMenu.select();
}

main();
