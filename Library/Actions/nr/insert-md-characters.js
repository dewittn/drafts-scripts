if (typeof ActionMenu == "undefined") require("shared/libraries/ActionMenu.js");

// Shows a menu of Markdown character actions and runs the one picked.
// actionList, the action names in menu order, is set in this action's Script
// step in Drafts, before the require line.
const actionMenu = ActionMenu.createFromList(actionList);
actionMenu.select();
