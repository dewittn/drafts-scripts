if (typeof BaseManager == "undefined") {
  require("modules/cp/managers/BaseManager.js");
}

/**
 * MenuOrchestrator - Handles UI menu coordination
 *
 * Responsibilities:
 * - Welcome screen with recent documents
 * - Current draft action menu
 * - Document selection by status
 * - Add content workflow
 */
class MenuOrchestrator extends BaseManager {
  constructor(context) {
    super(context);
  }

  /**
   * Show welcome screen with recent documents
   * @returns {string} Next action to perform
   */
  showWelcome() {
    const { menuPicker, menuSettings, errorMessage } = this.settings.welcome;

    // Create menu picker from recent records
    this.ui.utilities.addRecordColomsToMenuPicker(
      menuPicker,
      menuSettings,
      this.recent.records,
    );

    // Build and display menu
    const welcomeScreen = this.ui.buildMenu(menuSettings);
    if (welcomeScreen.show() == false) return "canceled";

    // Record input from prompt
    const nextFunction = welcomeScreen.buttonPressed;
    const index = this.ui.utilities.getIndexFromPromptPicker(
      welcomeScreen,
      menuPicker,
    );
    const record = this.recent.selectByIndex(index);

    this.activeDoc = this.documentFactory.load(record);

    return nextFunction;
  }

  /**
   * Show action menu for current draft
   * @returns {string} Next action to perform
   */
  showCurrentDraftMenu() {
    const { menuSettings } = this.settings.useCurrentDraft;

    if (draft.content == "") {
      return this.displayAppMessage("info", "Cannot use a blank draft!");
    }

    this.activeDoc = this.documentFactory.load({
      docID: draft.uuid,
      docIDType: "DraftsID",
    });

    // Build and display menu
    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return "canceled";

    return menu.buttonPressed;
  }

  /**
   * Show document selection menu filtered by status
   * @returns {string} Next action to perform
   */
  showDocumentsByStatus() {
    const { menuSettings, menuPicker } = this.settings.selectDocByStatus;

    // Get status selection
    const status = this.statuses.select();

    // Get records with that status
    if (menuSettings.menuItems.length > 3) {
      menuSettings.menuItems.pop();
    }

    const records = this.db.retrieveRecordsByField("Status", status);
    if (this.db.databaseError) {
      return this.throwDBError("MenuOrchestrator.showDocumentsByStatus()");
    }

    // Build picker with records
    menuPicker["columns"] = this.ui.utilities.createPickerFromRecords(records);
    menuSettings.menuItems.push({ type: "picker", data: menuPicker });

    // Show menu
    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return "canceled";

    // Load selected document
    const index = menu.fieldValues[menuPicker.name];
    this.activeDoc = this.documentFactory.load(records[index]);

    return menu.buttonPressed;
  }

  /**
   * Show add content menu
   * @returns {string} Next action to perform
   */
  showAddContentMenu() {
    const { menuSettings } = this.settings.addContent;

    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return "canceled";

    return menu.buttonPressed;
  }
}
