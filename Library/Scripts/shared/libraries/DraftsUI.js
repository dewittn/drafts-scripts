require("shared/libraries/UIUtilities.js");

class DraftsUI {
  #settings;
  #debug = false;

  constructor(settings) {
    this.utilities = new UIUtilities();
    this.#settings = settings;
  }

  get debug() {
    return this.#debug;
  }

  set debug(value) {
    this.#debug = value;
  }
  get draftLogUUID() {
    return this.#settings?.draftLogUUID;
  }

  settings(fnName) {
    if (this.#settings == undefined) return {};
    return this.#settings[fnName];
  }

  // Version 3 of the buildMenu function
  // Builds and returns a prompt based on the menuSettings object
  buildMenu(menuSettings) {
    // Create and return a prompt
    const prompt = Prompt.create();
    prompt.title = menuSettings.menuTitle;
    prompt.message = menuSettings.menuMessage;
    if (menuSettings.isCancellable != undefined)
      prompt.isCancellable = menuSettings.isCancellable;

    for (const menuItem of menuSettings.menuItems) {
      const {
        name,
        value,
        label,
        isDefault = false,
        allowMultiple = false,
        options = {},
        values = [],
        selectedValues = [],
        selectedRows,
        columns = [[]],
        initialText = "",
        initialDate = new Date(),
        initialValue = "",
      } = menuItem.data;
      switch (menuItem.type) {
        case "button":
          prompt.addButton(name, value, isDefault);
          break;
        case "datePicker":
          prompt.addDatePicker(name, label, initialDate, options);
          break;
        case "label":
          prompt.addLabel(name, label, options);
          break;
        case "password":
          prompt.addPasswordField(name, label, initialValue);
          break;
        case "picker":
          prompt.addPicker(name, label, columns, selectedRows);
          break;
        case "select":
          prompt.addSelect(name, label, values, selectedValues, allowMultiple);
          break;
        case "switch":
          prompt.addSwitch(name, label, initialValue);
          break;
        case "textField":
          prompt.addTextField(name, label, initialText, options);
          break;
        case "textView":
          prompt.addTextView(name, label, initialText, options);
          break;
      }
    }
    return prompt;
  }

  yesNoPrompt(menuSettings) {
    if (menuSettings == undefined)
      return this.displayErrorMessage({
        errorMessage: "Menu settings passed to yesNoPrompt() are undefined!",
        class: "DraftsUI",
        function: "yesNoPrompt()",
        menuSettings: menuSettings,
      });

    menuSettings["menuItems"] = [
      {
        type: "button",
        data: {
          name: "Yes",
          value: "yes",
        },
      },
      {
        type: "button",
        data: {
          name: "No",
          value: "no",
        },
      },
    ];

    const yesNo = this.buildMenu(menuSettings);
    yesNo.isCancellable = false;
    yesNo.show();
    return yesNo.buttonPressed;
  }

  displayErrorMessage(errorMessage, stackTrace) {
    if (stackTrace != undefined) this.#updateDraftLog(errorMessage, stackTrace);

    // Display Error Message
    app.displayErrorMessage(errorMessage);
    context.cancel(errorMessage);
    return false;
  }

  displayWarningMessage(warningMessage, stackTrace) {
    if (stackTrace != undefined)
      this.#updateDraftLog(warningMessage, stackTrace);

    app.displayWarningMessage(warningMessage);
  }

  displayInfoMessage(infoMessage, stackTrace) {
    // Update Error Log if UUID is found in settings
    if (stackTrace != undefined) this.#updateDraftLog(infoMessage, stackTrace);

    app.displayInfoMessage(infoMessage);
  }

  displaySuccessMessage(successMessage, stackTrace) {
    if (stackTrace != undefined)
      this.#updateDraftLog(successMessage, stackTrace);

    app.displaySuccessMessage(successMessage);
  }

  debugVariable(variable, text = "", debug = true) {
    this.debug = debug;
    const message = `${text}${JSON.stringify(variable)}`;
    console.log(message);
    if (this.#debug) alert(message);
  }

  displayAppMessage(type, message, stackTrace) {
    // Update Error Log if UUID is found in settings
    if (stackTrace != undefined) this.#updateDraftLog(message, stackTrace);

    switch (type) {
      case "info":
        app.displayInfoMessage(message);
        break;
      case "warning":
        app.displayWarningMessage(message);
        break;
      case "error":
        app.displayErrorMessage(message);
        break;
      default:
        app.displaySuccessMessage(message);
    }
  }

  #updateDraftLog(message, details = {}) {
    if (this.draftLogUUID == undefined) {
      console.log(message, JSON.stringify(details));
      return;
    }

    const draftLog = Draft.find(this.draftLogUUID);
    const timeCode = new Date().toString();

    draftLog.append(`**${message}**`, `\n\n--------- ${timeCode}\n`);
    for (const [key, value] of Object.entries(details)) {
      draftLog.append(`- ${key}: ${JSON.stringify(value)}`, "\n");
    }
    draftLog.update();
  }
}
