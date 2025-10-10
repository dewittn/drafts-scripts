if (typeof BaseManager == "undefined") require("modules/cp/managers/BaseManager.js");

/**
 * StatusManager - Handles status updates and synchronization
 *
 * Responsibilities:
 * - Updating document status
 * - Syncing status with external apps (Ulysses)
 * - Managing status transitions
 */
class StatusManager extends BaseManager {
  constructor(context) {
    super(context);
  }

  /**
   * Update the status of a document
   * @param {string} docID - Document ID
   * @param {string} docIDType - Document ID type
   * @returns {boolean} Success status
   */
  updateStatus(docID, docIDType) {
    const { errorMessage, errorMessage2, successMessage, menuSettings } =
      this.settings.updateStatusOfDoc;

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
        class: "StatusManager",
        function: "updateStatus()",
        docID: docID,
        docIDType: docIDType,
      });
    }

    // Validate document has title
    if (this.activeDoc.title == undefined) {
      return this.displayAppMessage("error", errorMessage2, {
        errorMessage: errorMessage2,
        class: "StatusManager",
        function: "updateStatus()",
        activeDoc: this.activeDoc,
      });
    }

    // Add to pipeline if not already there
    if (this.activeDoc.inPipeline == false) {
      // Need to call PipelineManager - will handle via context callback
      return { action: "addToPipeline", docID, docIDType };
    }

    // Get current record
    this.activeDoc.record = this.db.retrieveRecordByDocID(this.activeDoc);
    if (this.db.databaseError) {
      return this.throwDBError("StatusManager.updateStatus()");
    }

    // Build status menu
    menuSettings["menuItems"] = this.statuses.generateStatusMenuItems(
      this.activeDoc.status
    );
    menuSettings.menuMessage += `${this.activeDoc.title} is '${this.activeDoc.status}.'`;

    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    // Get new status selection
    const newStatus = menu.buttonPressed;
    if (newStatus == "back") {
      return { action: "back" };
    }

    this.activeDoc.status = newStatus;

    // Check if conversion needed
    const { covertDoc, newDocType } = this.destinations.lookupDocConvertionData(
      this.activeDoc.destination,
      newStatus
    );

    if (covertDoc) {
      // Need to call PipelineManager - will handle via context callback
      return { action: "convertDoc", newDocType };
    }

    // Update records and database
    this.#updateRecentRecords();
    this.#updateDatabase();

    if (this.db.databaseError) {
      return this.throwDBError("StatusManager.updateStatus()");
    }

    this.displayAppMessage("success", successMessage + newStatus);
    return true;
  }

  /**
   * Sync sheet status from database record
   * @param {string} targetId - Ulysses target ID
   */
  syncStatusFromDatabase(targetId) {
    const docData = { docID: targetId, docIDType: "UlyssesID" };
    const record = this.db.retrieveRecordByDocID(docData);
    const errorMessage = "No record found with that Target ID!";

    if (record == undefined) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "StatusManager",
        function: "syncStatusFromDatabase()",
        targetId: targetId,
        docData: docData,
        record: record,
      });
    }

    this.activeDoc = this.documentFactory.load(docData);
    this.activeDoc.status = record.Status;

    return true;
  }

  // Private methods
  #updateDatabase() {
    return this.db.updateUsingDoc(this.activeDoc);
  }

  #updateRecentRecords() {
    return this.recent.save(this.activeDoc);
  }
}
