if (typeof DraftsUI == "undefined") require("cp/ui/DraftsUI.js");
class ActionMenu {
  #ui;

  constructor(actionGroup) {
    this.#ui = new DraftsUI();
    this.groupActions = actionGroup.actions;
    this.menuSettings = {
      menuTitle: "Select Next Action",
      menuMessage: "Which action would you like to run next?",
    };

    this.menuSettings.menuItems = this.groupActions.map((action, index) => {
      return {
        type: "button",
        data: { name: this.#cleanActionName(action.name), value: index },
      };
    });
  }

  static createFromGroup(actionGroupName) {
    const actionGroup = ActionGroup.find(actionGroupName);
    return new ActionMenu(actionGroup);
  }

  static createFromList(actionList) {
    const actionGroup = new DynamicActionGroup(actionList);
    return new ActionMenu(actionGroup);
  }

  select() {
    const linkMenu = this.#ui.buildMenu(this.menuSettings);
    if (linkMenu.show() == false) return;

    this.#queueAction(linkMenu.buttonPressed);
  }

  selectAction(actionName) {
    const index = this.groupActions
      .map((action) => this.#cleanActionName(action.name))
      .indexOf(actionName);
    if (index >= 0) this.#queueAction(index);
  }

  #cleanActionName(name) {
    return name.replace("~", "");
  }

  #queueAction(selectedAction) {
    const action = this.groupActions[selectedAction];
    app.queueAction(action, draft);
  }
}

class DynamicActionGroup {
  #actions;

  constructor(actionNames) {
    this.#actions = actionNames.map((name) => Action.find(name));
  }

  get actions() {
    return this.#actions;
  }
}
