if (typeof DraftsUI == "undefined") require("shared/libraries/DraftsUI.js");
class ActionMenu {
  #ui;

  constructor(actionGroup) {
    this.#ui = new DraftsUI();
    this.groupActions = actionGroup != undefined ? actionGroup.actions : [];
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
    if (actionGroup == undefined) {
      const ui = new DraftsUI();
      ui.displayErrorMessage(
        `Action Group '${actionGroupName}' was not found!"`
      );
    }
    return new ActionMenu(actionGroup);
  }

  // A name with no matching action in Drafts is left out of the menu, with a
  // warning, so one renamed action does not break the whole menu.
  static createFromList(actionList) {
    const actionGroup = new DynamicActionGroup(actionList);
    if (actionGroup.missing.length > 0) {
      new DraftsUI().displayWarningMessage(`Actions not found: ${actionGroup.missing.join(", ")}`);
    }
    return new ActionMenu(actionGroup);
  }

  select() {
    if (this.groupActions.length == 0) return;

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
  #missing;

  constructor(actionNames) {
    this.#missing = actionNames.filter((name) => Action.find(name) == undefined);
    this.#actions = actionNames.map((name) => Action.find(name)).filter(Boolean);
  }

  get actions() {
    return this.#actions;
  }

  get missing() {
    return this.#missing;
  }
}
