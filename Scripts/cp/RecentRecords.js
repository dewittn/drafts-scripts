class RecentRecords {
  #ui;
  #db;
  #fs;
  #table;
  #recentDocsFile;
  #recentDocuments;
  #stackTrace;

  constructor(dependancies) {
    this.#ui = dependancies.ui;
    this.#db = dependancies.database;
    this.#fs = dependancies.fileSystem;
    this.#table = dependancies.tableName;
    this.#recentDocsFile = dependancies.settings.recentDocsFile;
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

    this.records = this.records
      // Moves currentRecord to the first spot in the array
      .reduce(
        (updatedRecords, record) => {
          return record.id != currentRecord.id ? [...updatedRecords, record] : updatedRecords;
        },
        [currentRecord]
      )
      // Remove null objects
      .filter((record) => record != null)
      // Truncates records to the first 15
      .splice(0, 15);

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

    this.records = this.records.filter((record) => record.id != activeDoc?.recordID);

    return this.#fs.write(this.#recentDocsFile, this.allRecords);
  }

  loadRecent() {
    const documents = this.#fs.read(this.#recentDocsFile);
    return documents != undefined ? documents : this.retrieveRecentFromDatabase();
  }

  retrieveRecentFromDatabase() {
    return this.#db
      .fields(["Title", "Updated", "DraftsID", "UlyssesID"])
      .maxRecords("10")
      .sort("Updated", "desc")
      .select();
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
    if (this.recordData?.fields?.docIDType != undefined)
      return { docID: this.recordData.fields.docID, docIDType: this.recordData.fields.docIDType };

    if (this.recordData?.fields?.DraftsID != undefined)
      return { docID: this.recordData.fields.DraftsID, docIDType: "DraftsID" };

    if (this.recordData?.fields?.UlyssesID != undefined)
      return { docID: this.recordData.fields.UlyssesID, docIDType: "UlyssesID" };

    return undefined;
  }
}
