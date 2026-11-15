class RecentRecords {
  #ui;
  #db;
  #fs;
  #table;
  #recentDocsFile;
  #recentDocuments;
  #stackTrace;

  constructor(dependencyProvider) {
    this.#ui = dependencyProvider.ui;
    this.#db = dependencyProvider.database;
    this.#fs = dependencyProvider.fileSystem;
    this.#table = dependencyProvider.tableName;
    this.#recentDocsFile = dependencyProvider.settings.recentDocsFile;
    this.#recentDocuments = this.loadRecent();
  }

  get records() {
    return this.#recentDocuments[this.#table];
  }

  set records(data) {
    this.#recentDocuments[this.#table] = data;
  }

  get allRecords() {
    return this.#recentDocuments;
  }

  get stackTrace() {
    return this.#stackTrace;
  }

  save(activeDoc) {
    if (activeDoc?.title == undefined) {
      this.#stackTrace = {
        errorMessage: "activeDoc?.title == undefined",
        class: "RecentRecord",
        function: "save()",
        activeDoc: activeDoc,
        title: activeDoc?.title,
      };
      return false;
    }

    const updated = new Date();
    const currentRecord = {
      id: activeDoc.recordID,
      fields: {
        Title: activeDoc.scrubedTitle,
        docID: activeDoc.docID,
        docIDType: activeDoc.docIDType,
        Destination: activeDoc.destination.toLowerCase(),
        Status: activeDoc.status,
        Updated: updated.toISOString(),
      },
    };

    // Replace any earlier entry for the same document
    this.records = this.records.filter((record) =>
      record != null && this.#docIDOf(record) != activeDoc.docID
    );
    this.records.unshift(currentRecord);
    this.records = this.records.slice(0, 15);
    // Return the status of the file that was written
    return this.#fs.write(this.#recentDocsFile, this.allRecords);
  }

  delete(activeDoc) {
    if (activeDoc == undefined) {
      this.#stackTrace = {
        errorMessage: "activeDoc == undefined",
        class: "RecentRecord",
        function: "delete()",
        activeDoc: activeDoc,
      };
      return false;
    }

    // Match on the document ID: a document opened from a menu has no database
    // record ID, and older entries keep it in DraftsID or UlyssesID
    const before = this.records.length;
    this.records = this.records.filter((record) =>
      this.#docIDOf(record) != activeDoc.docID
    );
    this.#ui.debugLog(
      `[RecentRecords] Removed ${before - this.records.length} of ${before} entries for ${activeDoc.docID}`
    );

    return this.#fs.write(this.#recentDocsFile, this.allRecords);
  }

  // The document ID of a stored entry, in any of its formats.
  #docIDOf(record) {
    return new RecentRecord(record).docID;
  }

  loadRecent() {
    const documents = this.#fs.read(this.#recentDocsFile);
    if (documents != undefined) {
      return documents;
    }

    // If no file exists, initialize with empty structure for this table
    const emptyStructure = {};
    emptyStructure[this.#table] = [];
    return emptyStructure;
  }

  retrieveRecentFromDatabase() {
    const records = this.#db
      .fields(["Title", "Updated", "DraftsID", "UlyssesID"])
      .maxRecords("10")
      .sort("Updated", "desc")
      .select();

    // Wrap in table structure
    const result = {};
    result[this.#table] = records;
    return result;
  }

  selectByIndex(index) {
    const recordData = this.records[index];
    if (recordData == undefined) return undefined;

    return new RecentRecord(recordData);
  }
}

class RecentRecord {
  constructor(data) {
    this.recordData = data;
    this.docData = this.getDocData();
  }

  get docID() {
    return this.docData?.docID;
  }

  get docIDType() {
    return this.docData?.docIDType;
  }

  get title() {
    return this.recordData.fields.Title;
  }

  get Title() {
    return this.title;
  }

  get id() {
    return this.recordData.id;
  }

  get fields() {
    return this.recordData;
  }

  getDocData() {
    if (this.recordData?.fields?.docIDType != undefined) {
      return {
        docID: this.recordData.fields.docID,
        docIDType: this.recordData.fields.docIDType,
      };
    }

    if (this.recordData?.fields?.DraftsID != undefined) {
      return { docID: this.recordData.fields.DraftsID, docIDType: "DraftsID" };
    }

    if (this.recordData?.fields?.UlyssesID != undefined) {
      return {
        docID: this.recordData.fields.UlyssesID,
        docIDType: "UlyssesID",
      };
    }

    return undefined;
  }
}
