if (typeof BaseManager == "undefined") require("modules/cp/managers/BaseManager.js");

/**
 * DocumentManager - Handles document CRUD operations
 *
 * Responsibilities:
 * - Opening documents
 * - Creating new documents
 * - Deleting documents
 * - Modifying document properties
 */
class DocumentManager extends BaseManager {
  constructor(context) {
    super(context);
  }

  /**
   * Open a document in its native application
   * @param {string} docID - Document identifier
   * @param {string} docIDType - Type of document ID (DraftsID, UlyssesID, etc.)
   */
  open(docID, docIDType) {
    const { docNotFound, recentDocsNotSaved } = this.settings.openDoc;

    // Load document if not already set
    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: docID,
        docIDType: docIDType,
      });
    }

    // Validate document was loaded
    if (this.activeDoc == undefined) {
      return this.displayAppMessage("error", docNotFound, {
        errorMessage: docNotFound,
        activeDoc: this.activeDoc,
      });
    }

    // Update recent records
    if (!this.#updateRecentRecords()) {
      this.displayAppMessage("info", recentDocsNotSaved, {
        recentRecordsUpdated: false,
        activeDoc: this.activeDoc,
      });
    }

    // Open the document
    this.activeDoc.open();
  }

  /**
   * Create a new document from template or blank
   */
  create() {
    this.activeDoc = this.documentFactory.create("draft");
    this.activeDoc.save();
    return this.activeDoc;
  }

  /**
   * Delete content from various locations
   * @returns {boolean} Success status
   */
  delete() {
    const { menuSettings } = this.settings.delContent;

    if (this.activeDoc == undefined) {
      return false;
    }

    // Build and display delete options menu
    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    let delRecentRecord = false;
    let delDBEntry = false;
    let delDoc = false;

    // Determine what to delete based on user selection
    switch (menu.buttonPressed) {
      case "everywhere":
        delDoc = true;
      case "database":
        delDBEntry = true;
      case "recentRecords":
        delRecentRecord = true;
    }

    // Execute deletions
    if (delRecentRecord) {
      this.recent.delete(this.activeDoc);
      this.displayAppMessage("success", "Doc deleted from Recent Records.");
    }

    if (delDBEntry) {
      this.db.delete(this.activeDoc);
      this.activeDoc.inPipeline = false;
      this.displayAppMessage("success", "Doc deleted from the database.");
    }

    if (delDoc) {
      this.activeDoc.delete();
      this.displayAppMessage("success", "Doc has been deleted.");
    }

    return true;
  }

  /**
   * Modify active document properties
   * @param {string} docIDType - Document ID type
   * @param {string} docID - Document ID
   */
  modify(docIDType, docID) {
    const { errorMessage, menuSettings } = this.settings.modifyActiveDoc;

    // Load document if needed
    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: docID,
        docIDType: docIDType,
      });
    }

    // Validate document loaded
    if (this.activeDoc == undefined) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "DocumentManager",
        function: "modify()",
        docIDType: docIDType,
        docID: docID,
      });
    }

    // Add convert option for Drafts
    if (this.activeDoc.docIDType == "DraftsID") {
      menuSettings.menuItems.push({
        type: "button",
        data: {
          name: "Convert Draft to Other Document",
          value: "convertDraft",
        },
      });
    }

    menuSettings.menuMessage = menuSettings.menuMessage.concat(
      this.activeDoc.title
    );

    // Show menu
    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    return menu.buttonPressed;
  }

  // Private methods
  #updateRecentRecords() {
    return this.recent.save(this.activeDoc);
  }
}
