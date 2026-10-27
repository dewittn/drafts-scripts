if (typeof ActionMenu == "undefined") require("shared/libraries/ActionMenu.js");
const actionList = [
  "Record Attendace",
  "Bus Ride Home",
  "Record Game Score",
  "Submit Game Report",
  "Edit Game",
  "Create Practice Plan",
];

const actionMenu = ActionMenu.createFromList(actionList);
actionMenu.select();
