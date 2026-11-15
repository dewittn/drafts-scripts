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
   * Remove the active document at one of three levels. Each level includes
   * the ones below it:
   * - recent: remove it from Recent Records
   * - pipeline: also delete its database record and pipeline tags
   * - document: also move the document to its app's trash
   * The database goes first since it is the step that can fail and cannot be
   * undone; nothing else changes when it fails.
   * @returns {boolean} Success status
   */
  delete() {
    const { menuSettings, confirmSettings, successMessages } = this.settings.delContent;
    if (this.activeDoc == undefined) return false;

    const menu = this.ui.buildMenu({
      ...menuSettings,
      menuMessage: menuSettings.menuMessage.concat(this.activeDoc.title),
    });
    if (menu.show() == false) return context.cancel();

    const level = menu.buttonPressed;
    if (level != "recent" && this.#confirmDelete(confirmSettings, level) == false) return false;

    if (level != "recent" && this.#removeFromPipeline() == false) return false;
    if (level == "document") this.activeDoc.delete();
    this.recent.delete(this.activeDoc);

    this.displayAppMessage("success", successMessages[level]);
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

  // Asks before a level that deletes the database record. True on Yes.
  #confirmDelete(confirmSettings, level) {
    const answer = this.ui.yesNoPrompt({
      menuTitle: confirmSettings.menuTitle,
      menuMessage: confirmSettings.messages[level],
    });
    return answer == "yes";
  }

  // Deletes the database record, then the document's pipeline tags.
  #removeFromPipeline() {
    if (this.db.deleteUsingDoc(this.activeDoc) == false) {
      this.throwDBError("DocumentManager.delete()");
      return false;
    }

    this.activeDoc.inPipeline = false;
    return true;
  }

  #updateRecentRecords() {
    return this.recent.save(this.activeDoc);
  }
}
