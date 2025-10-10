if (typeof BaseManager == "undefined") require("modules/cp/managers/BaseManager.js");

/**
 * PipelineManager - Handles pipeline entry management
 *
 * Responsibilities:
 * - Adding documents to pipeline
 * - Converting documents between types
 * - Attaching default notes
 * - Managing pipeline status
 */
class PipelineManager extends BaseManager {
  constructor(context) {
    super(context);
  }

  /**
   * Add document to the Content Pipeline
   * @param {string} docIDType - Document ID type
   * @param {string} docID - Document ID
   * @returns {boolean} Success status
   */
  addDocument(docIDType, docID = undefined) {
    const {
      successMessage,
      errorMessage,
      docExistsMessage,
      infoMessage,
      menuSettings,
    } = this.settings.addDocToPipeline;

    // Load document if not already set
    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: docID,
        docIDType: docIDType,
      });
    }

    // Check if doc is already in pipeline
    if (this.#docIsInPipeline()) {
      return this.displayAppMessage("info", docExistsMessage);
    }

    if (this.db.databaseError) {
      return this.throwDBError("PipelineManager.addDocument()");
    }

    // Prompt to add doc to pipeline
    if (this.ui.yesNoPrompt(menuSettings) === "no") {
      this.displayAppMessage("info", infoMessage);
      return false;
    }

    // Select Status & destination
    if (this.activeDoc.statusIsNotSet) {
      this.activeDoc.status = this.statuses.select(this.activeDoc.title);
    }

    if (this.activeDoc.destinationIsNotSet) {
      this.activeDoc.destination = this.destinations.select(
        this.activeDoc.title
      );
    }

    // Update database with activeDoc
    if (!this.#updateDatabase()) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "PipelineManager",
        function: "addDocument()",
        activeDoc: this.activeDoc,
      });
    }

    if (this.db.databaseError) {
      return this.throwDBError("PipelineManager.addDocument()");
    }

    // Update document with record info
    this.activeDoc.record = this.db.currentRecord;
    this.activeDoc.inPipeline = true;

    // Update recent records
    const warningMessage = "Recent Records could not be saved!";
    if (!this.#updateRecentRecords()) {
      this.displayAppMessage("warning", warningMessage, {
        warningMessage: warningMessage,
        class: "PipelineManager",
        function: "addDocument()",
        activeDoc: this.activeDoc,
      });
    }

    this.displayAppMessage("success", successMessage);
    return true;
  }

  /**
   * Add default notes to a sheet
   * @param {string} targetId - Ulysses sheet target ID
   */
  addDefaultNotes(targetId) {
    const {
      infoMessage,
      errorMessage1,
      errorMessage2,
      successMessage,
      menuSettings,
    } = this.settings.addSheetToPipeline;

    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: targetId,
        docIDType: "UlyssesID",
      });
    }

    // Attach default notes to the document
    this.activeDoc.attachDefaultNotes();
  }

  /**
   * Convert a draft to another document type
   * @param {string} uuid - Draft UUID (defaults to current draft)
   */
  convertDraft(uuid = draft.uuid) {
    const { recentDocsNotSaved } = this.settings.convertDraft;

    // Load draft if needed
    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: uuid,
        docIDType: "DraftsID",
      });
    }

    // Get or create pipeline record
    const record = this.db.retrieveRecordByDocID(this.activeDoc);
    if (record == undefined) {
      this.addDocument("DraftsID", uuid);
    }

    this.activeDoc.record = record;

    // Determine target document type
    const { newDocType } = this.destinations.lookupDocConvertionData(
      this.activeDoc.destination
    );

    // Perform conversion
    this.#convertActiveDoc(newDocType);

    // Update recent records
    if (!this.#updateRecentRecords()) {
      this.displayAppMessage("info", recentDocsNotSaved, {
        activeDoc: this.activeDoc,
      });
    }

    this.displayAppMessage(
      "success",
      `Draft has been converted to a ${newDocType}.`
    );
  }

  // Private methods
  #docIsInPipeline() {
    return this.db.docIsInPipeline(this.activeDoc);
  }

  #updateDatabase() {
    return this.db.updateUsingDoc(this.activeDoc);
  }

  #updateRecentRecords() {
    return this.recent.save(this.activeDoc);
  }

  #convertActiveDoc(newDocType) {
    if (this.activeDoc == undefined || newDocType == undefined) {
      return false;
    }

    const errorMessage = "Document could not be created!";

    // Create new document
    const newDoc = this.documentFactory.create(newDocType);
    if (newDoc == undefined || newDoc == false) {
      return false;
    }

    // Copy properties from old doc to new doc
    newDoc.status = this.activeDoc.status;
    newDoc.destination = this.activeDoc.destination;
    newDoc.content = this.activeDoc.content;

    if (newDoc.save() == false) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "PipelineManager",
        function: "#convertActiveDoc()",
        docType: newDoc.docIDType,
        stackTrace: newDoc?.stackTrace,
      });
    }

    // Update database with new document
    newDoc.record = this.activeDoc.record;
    const success = this.db.updateUsingDoc(newDoc);

    if (this.db.databaseError) {
      return this.throwDBError("PipelineManager.#convertActiveDoc()");
    }

    // Delete old document and update active reference
    this.activeDoc.delete();
    this.activeDoc = newDoc;

    return true;
  }
}
