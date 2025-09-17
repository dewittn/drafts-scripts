require("libraries/nocodb.js");

class NocoDBClass {
  #ui;
  #text;
  #settings;
  #database;
  #tableName;
  #stackTrace;
  #defaultFields;
  #databaseError = false;

  constructor(dependencies) {
    this.#ui = dependencies.ui;
    this.#tableName = dependencies.tableName;
    this.#settings = dependencies.settings.nocodb;
    this.#defaultFields = this.#settings.defaultFields;
    this.#text = dependencies.textUtilities;
    this.#database = new NocoDB().base().table(this.#tableName);
  }

  get debug() {
    return this.#database.debug;
  }

  set debug(value) {
    this.#database.debug = value;
  }

  get databaseError() {
    return this.#database.error;
  }

  get stackTrace() {
    return this.#stackTrace;
  }

  get currentRecord() {
    return this.#database.firstRecord;
  }

  // Checks if a document is in the pipeline database
  // Return true or false
  docIsInPipeline(doc) {
    return this.retrieveRecordByDocID(doc) != undefined;
  }

  // Updates or creates a NocoDB record for document
  updateUsingDoc(doc) {
    if (doc?.docID == undefined || doc?.docIDType == undefined) {
      return this.#throwError({
        errorMessage: "doc is missing docID or docIDType!",
        errorType: "execution",
        class: "NocoDBClass",
        function: "updateUsingDoc()",
        doc: doc,
      });
    }

    // Constructs a new record that will be saved using the current doc data
    // Copies the NocoDB ID if it exists
    const fields = {
      docID: doc.docID,
      docIDType: doc.docIDType,
      Destination: doc.airtableDestination,
      Title: doc.scrubedTitle,
      slug: doc.slug,
      Status: doc.status,
      Priority: this.#settings.defaultPriority,
    };
    const recordToSave = this.#createRecord(fields);
    if (doc.record?.id != undefined) recordToSave.id = doc.record.id;

    // Scrub Record for fields that could cause a NocoDB http 422 error
    Object.keys(recordToSave.fields).forEach((key) => {
      if (this.#defaultFields.includes(key) == false)
        recordToSave.removeField(key);
    });

    const success = this.#database.saveRecords(recordToSave);
    const savedRecord = this.#database.firstRecord;

    // If there is a problem with the request throw an error
    if (success == false || savedRecord == undefined) {
      return this.#throwError({
        errorMessage: "Record could not be saved!",
        errorType: "connection",
        NocoDBError: this.#database.error,
        NocoDBMessage: this.#database.errorMessage,
        class: "NocoDBClass",
        function: "updateUsingDoc()",
        doc: doc,
        record: doc.record,
        savedRecord: savedRecord,
      });
    }

    return savedRecord;
  }

  retrieveRecordById(recordId) {
    const success = this.#database.findById(recordId);
    if (this.databaseError) {
      this.#throwError({
        errorMessage: "NocoDB Error",
        errorType: "connection",
        NocoDBError: this.#database.error,
        NocoDBMessage: this.#database.errorMessage,
        class: "NocoDBClass",
        function: "retrieveRecordById()",
        recordId: recordId,
      });
      return undefined;
    }

    return this.#database.firstRecord;
  }

  retrieveRecordByField(field, value) {
    this.retrieveRecordsByField(field, value);
    return this.#database.firstRecord;
  }

  retrieveRecordsByField(field, value, sort) {
    if (sort != undefined) this.#database.sort(sort);
    this.#database.fields(this.#settings.defaultFields);

    const success = this.#database.findByField(field, value);
    if (this.databaseError) {
      this.#throwError({
        errorMessage: "NocoDB Error",
        errorType: "connection",
        NocoDBError: this.#database.error,
        NocoDBMessage: this.#database.errorMessage,
        class: "NocoDBClass",
        function: "retrieveRecordsByField()",
        field: field,
        value: value,
        sort: sort,
      });
      return undefined;
    }

    return this.#database.records;
  }

  retrieveRecordByDocID(doc) {
    if (doc?.docID == undefined) {
      this.#databaseError = true;
      this.#stackTrace = {
        message: "docID is missing!",
        class: "NocoDBClass",
        function: "docIsInPipeline()",
        doc: doc,
      };
      return undefined;
    }

    this.#database.fields(this.#settings.defaultFields);

    const findByDocID = this.#database.findFirstByField("docID", doc.docID);
    if (this.databaseError) {
      this.#throwError({
        errorMessage: "NocoDB Error",
        errorType: "connection",
        NocoDBError: this.#database.error,
        NocoDBMessage: this.#database.errorMessage,
        class: "NocoDBClass",
        function: "retrieveRecordByDocID()",
        doc: doc,
      });
      return undefined;
    }

    if (this.#database.firstRecord != undefined)
      return this.#database.firstRecord;

    if (doc?.docIDType == undefined) {
      this.#throwError({
        errorMessage: "docIDType is missing!",
        errorType: "execution",
        class: "NocoDBClass",
        function: "docIsInPipeline()",
        doc: doc,
      });

      return undefined;
    }
    const findByDocIDType = this.#database.findFirstByField(
      doc.docIDType,
      doc.docID
    );
    if (this.databaseError) {
      this.#throwError({
        errorMessage: "NocoDB Error",
        errorType: "connection",
        NocoDBError: this.#database.error,
        NocoDBMessage: this.#database.errorMessage,
        class: "NocoDBClass",
        function: "retrieveRecordByDocID()",
        doc: doc,
      });
      return undefined;
    }

    return this.currentRecord;
  }

  #createRecord(fields) {
    return NocoRecord.create({ id: null, fields: fields });
  }

  #throwError(errorData) {
    this.#stackTrace = errorData;
    return false;
  }
}

Object.defineProperty(NocoRecord.prototype, "docID", {
  get: function docID() {
    if (this.fields?.docID != undefined) return this.fields.docID;
    if (this.fields?.DraftsID != undefined) return this.fields.DraftsID;
    if (this.fields?.UlyssesID != undefined) return this.fields.UlyssesID;

    return undefined;
  },
});
Object.defineProperty(NocoRecord.prototype, "docIDType", {
  get: function docIDType() {
    if (this.fields?.docID != undefined) return this.fields.docIDType;
    if (this.fields?.DraftsID != undefined) return "DraftsID";
    if (this.fields?.UlyssesID != undefined) return "UlyssesID";

    return undefined;
  },
});