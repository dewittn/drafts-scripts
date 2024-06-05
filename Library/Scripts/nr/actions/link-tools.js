require("cp/ui/DraftsUI.js");

const ui = new DraftsUI();
ui.debug = true;
const linkToolsGroup = ActionGroup.find("Link Tools");
const linkActions = linkToolsGroup.actions;

menuSettings = {
  menuTitle: "Selcet action",
  menuMessage: "Which action would you like to use?",
};

menuSettings.menuItems = linkActions.map((action, index) => {
  return { type: "button", data: { name: action.name, value: index } };
});

const linkMenu = ui.buildMenu(menuSettings);
if (linkMenu.show()) {
  const actionSelected = linkActions[linkMenu.buttonPressed];
  app.queueAction(actionSelected, draft);
}
