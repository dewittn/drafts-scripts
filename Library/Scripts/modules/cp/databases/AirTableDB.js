require("shared/libraries/airtable-v2.js");

class AirTableDB {
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
    this.#settings = dependencies.settings.airTable;
    this.#defaultFields = this.#settings.defaultFields;
    this.#text = dependencies.textUtilities;
    this.#database = new Airtable().base().table(this.#tableName);
  }

  get debug() {
    this.#database.debug;
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

  // Updates or creates an AirTable record for document
  updateUsingDoc(doc) {
    if (doc?.docID == undefined || doc?.docIDType == undefined) {
      return this.#throwError({
        errorMessage: "doc is missing docID or docIDType!",
        errorType: "execution",
        class: "AirTableDB",
        function: "updateUsingDoc()",
        doc: doc,
      });
    }

    // Constructs a new record that will be saved using the current doc data
    // Copies the AirTable ID if it exists
    const fields = {
      docID: doc.docID,
      docIDType: doc.docIDType,
      Destination: doc.airtableDestination,
      Title: doc.scrubedTitle,
      Slug: doc.slug,
      Status: doc.status,
      Priority: this.#settings.defaultPriority,
    };
    const recordToSave = this.#createRecord(fields);
    if (doc.record?.id != undefined) recordToSave.id = doc.record.id;

    // Scrub Record for fields that could cause an AirTable http 422 error
    Object.keys(recordToSave.fields).forEach((key) => {
      if (this.#defaultFields.includes(key) == false) {
        recordToSave.removeField(key);
      }
    });

    const sucess = this.#database.saveRecords(recordToSave);
    const savedRecord = this.#database.firstRecord;

    // If there is a problem with the request throw an error
    if (sucess == false || savedRecord == undefined) {
      return this.#throwError({
        errorMessage: "Record could not be saved!",
        errorType: "connection",
        AirTableError: this.#database.error,
        AirTableMessage: this.#database.errorMessage,
        class: "AirTableDB",
        function: "updateUsingDoc()",
        doc: doc,
        record: doc.record,
        savedRecord: savedRecord,
      });
    }

    return savedRecord;
  }

  retrieveRecordById(recordId) {
    const sucess = this.#database.findById(recordId);
    if (this.databaseError) {
      this.#throwError({
        errorMessage: "AirTable Error",
        errorType: "connection",
        AirTableError: this.#database.error,
        AirTableMessage: this.#database.errorMessage,
        class: "AirTableDB",
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

    const sucess = this.#database.findByField(field, value);
    if (this.databaseError) {
      this.#throwError({
        errorMessage: "AirTable Error",
        errorType: "connection",
        AirTableError: this.#database.error,
        AirTableMessage: this.#database.errorMessage,
        class: "AirTableDB",
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
        class: "AirTableDB",
        function: "docIsInPipeline()",
        doc: doc,
      };
      return undefined;
    }

    this.#database.fields(this.#settings.defaultFields);

    const findByDocID = this.#database.findFirstByField("docID", doc.docID);
    if (this.databaseError) {
      this.#throwError({
        errorMessage: "AirTable Error",
        errorType: "connection",
        AirTableError: this.#database.error,
        AirTableMessage: this.#database.errorMessage,
        class: "AirTableDB",
        function: "retrieveRecordByDocID()",
        doc: doc,
      });
      return undefined;
    }

    if (this.#database.firstRecord != undefined) {
      return this.#database.firstRecord;
    }

    if (doc?.docIDType == undefined) {
      this.#throwError({
        errorMessage: "docIDType is missing!",
        essorType: "execution",
        class: "AirTableDB",
        function: "docIsInPipeline()",
        doc: doc,
      });

      return undefined;
    }
    const findByDocIDType = this.#database.findFirstByField(
      doc.docIDType,
      doc.docID,
    );
    if (this.databaseError) {
      this.#throwError({
        errorMessage: "AirTable Error",
        errorType: "connection",
        AirTableError: this.#database.error,
        AirTableMessage: this.#database.errorMessage,
        class: "AirTableDB",
        function: "retrieveRecordByDocID()",
        doc: doc,
      });
      return undefined;
    }

    return this.currentRecord;
  }

  #createRecord(fields) {
    return ATRecord.create({ id: null, fields: fields });
  }

  #throwError(errorData) {
    this.#stackTrace = errorData;
    return false;
  }
}

Object.defineProperty(ATRecord.prototype, "docID", {
  get: function docID() {
    if (this.fields?.docID != undefined) return this.fields.docID;
    if (this.fields?.DraftsID != undefined) return this.fields.DraftsID;
    if (this.fields?.UlyssesID != undefined) return this.fields.UlyssesID;

    return undefined;
  },
});
Object.defineProperty(ATRecord.prototype, "docIDType", {
  get: function docIDType() {
    if (this.fields?.docID != undefined) return this.fields.docIDType;
    if (this.fields?.DraftsID != undefined) return "DraftsID";
    if (this.fields?.UlyssesID != undefined) return "UlyssesID";

    return undefined;
  },
});
