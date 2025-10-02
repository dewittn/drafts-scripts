if (typeof ActionMenu == "undefined") require("shared/libraries/ActionMenu.js");
const actionList = [
  "Record Attendace",
  "Record Game Score",
  "Submit Game Report",
  "Create Practice Plan",
];

const actionMenu = ActionMenu.createFromList(actionList);
actionMenu.select();
