if (typeof BaseManager == "undefined") require("modules/cp/managers/BaseManager.js");

/**
 * NavigationManager - Handles URL generation and navigation
 *
 * Responsibilities:
 * - Getting published post URLs
 * - Function routing/navigation
 * - Year selection
 */
class NavigationManager extends BaseManager {
  constructor(context) {
    super(context);
  }

  /**
   * Get URL of a published post
   * @param {number} year - Year to filter by
   * @returns {string} Post URL
   */
  getPublishedPostURL(year = new Date().getFullYear()) {
    const { menuSettings, menuPicker } = this.settings.getPublishedPostURL;

    const records = this.db.retrieveRecordsByField(
      "Status",
      `Published ${year}✨`,
      {
        field: "Publish Date",
        direction: "desc",
      }
    );

    // Build menu picker
    if (menuSettings.menuItems.length > 2) {
      menuSettings.menuItems.pop();
    }

    menuPicker["columns"] = this.ui.utilities.createPickerFromRecords(records);
    menuSettings.menuItems.push({ type: "picker", data: menuPicker });

    // Display menu
    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    const nextFunction = menu.buttonPressed;

    // Handle year change request
    if (nextFunction == "getPublishedPostURL") {
      const newYear = this.#selectYear();
      if (newYear == undefined) return context.cancel();
      return { action: "changeYear", year: newYear };
    }

    // Return selected post URL
    const index = menu.fieldValues[menuPicker.name];
    return records[index]?.Link;
  }

  /**
   * Route to the next function
   * @param {string} name - Function name
   * @param {*} args - Arguments to pass
   * @returns {*} Result of function call
   */
  routeToFunction(name, args) {
    const errorMessage = "Function name missing!";

    if (name == undefined) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "NavigationManager",
        function: "routeToFunction()",
        name: name,
      });
    }

    if (Array.isArray(args) == false) {
      args = [args];
    }

    console.log(`\n\n#######\nRouting to function: ${name}`);
    return { action: name, args: args };
  }

  // Private methods
  #selectYear() {
    const { infoMessage, menuSettings } = this.settings.selectYear;
    const chooseYear = this.ui.buildMenu(menuSettings);
    chooseYear.show();

    const index = chooseYear.fieldValues["year"][0];
    return menuSettings.menuItems[0].data.columns[0][index];
  }
}
