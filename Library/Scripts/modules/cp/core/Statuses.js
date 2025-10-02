class Statuses {
  #ui;
  #settings;
  #statusList;

  constructor(dependencyProvider) {
    this.#ui = dependencyProvider.ui;
    this.#settings = dependencyProvider.settings.statuses;
    this.#statusList = this.#settings.statusList;
  }

  get statusList() {
    return this.#statusList;
  }

  getCurrentStatus(testFunction) {
    return this.#statusList.filter((status) => testFunction(status)).toString();
  }

  select(title = "") {
    const { menuSettings, errorMessage } = this.#settings.selectStatus;

    menuSettings.menuMessage = title == ""
      ? `${menuSettings.menuMessage} to work with.`
      : `${menuSettings.menuMessage} for: ${title}`;
    menuSettings.isCancellable = false;
    menuSettings.menuItems = [];

    this.statusList.forEach((status) =>
      menuSettings.menuItems.push({
        type: "button",
        data: {
          name: this.#titleCase(status),
          value: status,
        },
      })
    );

    const choseStatus = this.#ui.buildMenu(menuSettings);

    // Displays prompt and returns chosen status
    if (choseStatus.show() == false) {
      return this.#ui.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "Statuses",
        function: "select",
      });
    }

    return choseStatus.buttonPressed;
  }

  // Removes the current status from the statusList and generates an options menu
  generateStatusMenuItems(currentStatus) {
    const index = this.statusList.findIndex(
      (status) => status == currentStatus,
    );
    // statusList.splice(0, index + 1);
    return this.statusList
      .slice(index + 1, this.statusList.length)
      .reduce(
        (obj, status) => [
          ...obj,
          { type: "button", data: { name: status, value: status } },
        ],
        [
          {
            type: "button",
            data: { name: "<< Back", value: "back", isDefault: true },
          },
        ],
      );
  }

  #titleCase(str) {
    str = str.toLowerCase().split(" ");
    for (var i = 0; i < str.length; i++) {
      str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
    }
    return str.join(" ");
  }
}
