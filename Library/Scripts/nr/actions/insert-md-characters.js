if (typeof ActionMenu == "undefined") require("libraries/ActionMenu.js");
const actionList = [
  "Markdown Table",
  "Markdown Horizontal",
  "Inline Code (`)",
  "Code Block (```)",
  "Highlight",
];

const actionMenu = ActionMenu.createFromList(actionList);
actionMenu.select();
