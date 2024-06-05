// draftsTables by Nelson/Roberto (@dewittn)
// An Airtable API wrapper for Drafts

// ***************
// * Airtable Class
// ***************
class Airtable {
  static endPointURL = "https://api.airtable.com/v0";
  static filesPath = "/Library/Data";

  #apiKey;
  #defaultBaseID;

  constructor(key) {
    this.#apiKey = key;
    this.#authorize();
  }

  get endPointURL() {
    return this.constructor.endPointURL;
  }

  get filesPath() {
    return this.constructor.filesPath;
  }

  get apiKey() {
    return this.#apiKey;
  }

  base(baseID = this.#defaultBaseID) {
    return new ATBase(this, baseID);
  }

  // Setup & Store Credentials
  #authorize() {
    let credential = Credential.create("AirTable", "AirTable API");
    credential.addPasswordField("api_key", "API Key");
    credential.addTextField("baseID", "Default Base ID");
    credential.authorize();
    this.#apiKey = credential.getValue("api_key");
    this.#defaultBaseID = credential.getValue("baseID");
  }

  // Allows BaseIDs to be stored in an iCloud json file.
  // Default base id is used if no name is specified
  #baseLookup(baseName) {
    if (baseName == "default") return this.defaultBaseID;

    // read from file in iCloud
    let fmCloud = FileManager.createCloud(); // Connect to iCloud storage
    const bases = fmCloud.readJSON(`${this.filesPath}/bases.json`);
    return bases[baseName];
  }
}

// ***************
// * ATBase Class
// ***************
class ATBase {
  #airtable;
  #baseID;

  constructor(airtable, baseID) {
    this.#airtable = airtable;
    this.#baseID = baseID;
  }

  get baseID() {
    return this.#baseID;
  }

  table(tableName) {
    return new ATTable(this.#airtable, this, tableName);
  }
}

// ***************
// * ATTable Class
// ***************
class ATTable {
  #airtable;
  #base;
  #table;
  #params = {};
  #records = [];
  #sort = [];
  #offset = false;
  #debug = false;
  #error = false;
  #errorMessage = "";

  static errorCodes = {
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    413: "Request Entity Too Large",
    422: "Invalid Request",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
  };

  constructor(airtable, base, tableName) {
    this.#airtable = airtable;
    this.#base = base;
    this.#table = tableName;
  }

  // *******
  // Property Methods
  get records() {
    return this.#records;
  }

  get firstRecord() {
    return this.#records[0];
  }

  get URLSafeName() {
    return this.#table.replace(" ", "%20");
  }

  get tableName() {
    return this.#table;
  }

  get params() {
    return this.#params;
  }

  get offset() {
    return this.#offset;
  }

  set offset(value) {
    this.#offset = value;
  }

  get debug() {
    return this.#debug;
  }
  set debug(value) {
    this.#debug = value;
  }

  get errorCodes() {
    return this.constructor.errorCodes;
  }

  get endPointURL() {
    return this.#airtable.endPointURL;
  }

  get baseID() {
    return this.#base.baseID;
  }

  get error() {
    return this.#error;
  }

  get errorMessage() {
    return this.#errorMessage;
  }

  // *********
  // Filter Functions
  // *********

  // A string containing all the fields to include in the return separated by ,
  // "Title,Status,Priority"
  fields(value) {
    if (typeof value === "string") value = value.split(",");
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        this.#params[`fields[${i}]`] = value[i];
      }
    }
    return this;
  }

  // A string containing a filter by formula
  filterBy(value) {
    if (typeof value === "string") this.#params["filterByFormula"] = value;
    return this;
  }

  //  containing the maximum number of records to return
  maxRecords(value) {
    if (typeof value === "number") value = value.toString();
    if (typeof value === "string") this.#params["maxRecords"] = value;
    return this;
  }

  // The number of records returned in each request.
  // Must be less than or equal to 100. Default is 100.
  pageSize(value) {
    if (typeof value === "number") value = value.toString();
    if (typeof value === "string") this.#params["pageSize"] = value;
    return this;
  }

  view(vaule) {
    if (typeof value === "string") this.#params["view"] = value;
    return this;
  }

  // Expects an object with keys field and direction
  // { field: value, direction: value }
  // Direction can either be "asc" or "desc"
  sort(sortObj) {
    if (sortObj == undefined) return;
    this.#sort.push(sortObj);
    this.#sort.forEach((sort, i) => {
      this.#params[`sort[${i}][field]`] = sort.field;
      this.#params[`sort[${i}][direction]`] = sort.direction;
    });
    return this;
  }

  // *********
  // GET Functions
  // *********
  select(params = this.#params) {
    const response = this.#makeHTTPRequest({ method: "GET", parameters: params });
    if (response.success) response.data.forEach((record) => this.#addRecord(record));

    return this.#records;
  }

  findById(id) {
    const response = this.#makeHTTPRequest({ method: "GET", parameters: this.#params }, id);
    if (response.success) this.#addRecord(response.data);

    return this.#records[0];
  }

  // Returns an array of records by a field value
  findByField(field, value) {
    this.#records = [];
    this.#params["filterByFormula"] = `{${field}} = '${value}'`;
    let payload = {
      method: "GET",
      parameters: this.#params,
    };

    const response = this.#makeHTTPRequest(payload);
    if (response.success) response.data.forEach((record) => this.#addRecord(record));

    return this.#records;
  }

  // Returns a the first record by a field value
  findFirstByField(field, value) {
    this.#records = [];
    this.#params["filterByFormula"] = `{${field}} = '${value}'`;
    const payload = {
      method: "GET",
      parameters: this.#params,
    };
    const response = this.#makeHTTPRequest(payload);
    if (response.success && response.data[0] != undefined) this.#addRecord(response.data[0]);

    return this.#records[0];
  }

  // List all records from a Table
  findAllRecords() {}

  // *********
  // POST Functions
  // *********

  // Create new records in table
  createRecords(records = this.records, typecast = false) {
    if (Array.isArray(records) == false) records = [records];

    const requestBody = records.map((record) => ({ fields: record.fields }));
    const payload = { method: "POST", data: { records: requestBody, typecast: typecast } };

    const response = this.#makeHTTPRequest(payload);
    if (response.success) response.data.forEach((record) => this.#addRecord(record));

    return response.success;
  }

  // *********
  // PATCH Functions
  // *********

  update(records = this.records) {
    // var requestBody = new Array();
    if (Array.isArray(records) == false) records = [records];
    const requestBody = records.map((record) => ({ id: record.id, fields: record.fields }));
    const payload = { method: "PATCH", data: { records: requestBody } };

    const response = this.#makeHTTPRequest(payload);
    if (response.success) response.data.forEach((record) => this.#addRecord(record));

    return response.success;
  }

  // *********
  // DELETE Functions
  // *********

  // New method, deletes all records with a single request
  // Record IDs must be stored as HTML arrays and sent as parameters
  // record[0]="",record[1]=""
  delete(records) {
    let requestBody = {};
    if (!Array.isArray(records)) records = [records];
    for (let i = 0; i < records.length; i++) {
      requestBody[`records[${i}]`] = records[i].id;
    }
    const payload = { method: "DELETE", parameters: requestBody };
    const response = this.#makeHTTPRequest(payload);

    return response.success;
  }

  // *********
  // Other Functions
  // *********

  // Calls update() and create()
  saveRecords(records) {
    let success = false;
    if (this.#checkForArrayOrRecord(records)) records = [records];
    const recordsToUpdate = records
      .map((record) => {
        if (record.id) return record;
      })
      .filter(Boolean);
    const recordsToCreate = records
      .map((record) => {
        if (record.id == undefined || record.id == null) return record;
      })
      .filter(Boolean);

    if (recordsToUpdate?.length > 0) success = this.update(recordsToUpdate);
    if (recordsToCreate?.length > 0) success = this.createRecords(recordsToCreate);

    // needs to return array of updated records
    return success;
  }

  // Debugging function to make sure Parameters are begin set correctly
  getParam(key) {
    return this.#params[key];
  }

  // Returns a new record
  newRecord() {
    return new ATRecord();
  }

  // ***********
  // Private Functions
  // ***********
  #addRecord(data) {
    this.#records.push(ATRecord.create(data));
  }

  #makeHTTPRequest(payload, id = "") {
    const url = `${this.endPointURL}/${this.baseID}/${this.URLSafeName}/${id}`;
    if (this.offset) payload.parameters["offset"] = this.offset;

    let debugMessage = `\n---------\nURL: ${url}\n\nPayload: ${JSON.stringify(payload)}`;

    const request = Object.assign(
      {
        url: url,
        headers: {
          Authorization: `Bearer ${this.#airtable.apiKey}`,
          "Content-Type": "application/json",
        },
      },
      payload
    );
    const http = HTTP.create();
    const response = http.request(request);

    if (response.success == false) return this.#requestError(response, debugMessage);

    const results = {
      success: response.success,
      data: this.#formatResponseText(response?.responseText),
    };

    debugMessage = `${debugMessage}\n\nResponse: ${response.responseText}`;
    if (this.#debug) console.log(debugMessage);

    // save offset and clear params once request is complete
    this.offset = results.offset;
    this.#params = {};

    return results;
  }

  #requestError(response, debugMessage) {
    this.#error = true;
    this.#errorMessage = `Airtable Error: ${response.statusCode} - ${this.#checkError(response.statusCode)}`;
    app.displayErrorMessage(this.#errorMessage);

    debugMessage = `${debugMessage}\n\n${this.#errorMessage}`;
    if (this.#debug) console.log(debugMessage);

    return false;
  }

  #formatResponseText(text) {
    const formatedTxt = JSON.parse(text);
    return formatedTxt?.records != undefined ? formatedTxt.records : formatedTxt;
  }

  #checkError(code) {
    return this.errorCodes[code];
  }

  #checkForArrayOrRecord(obj) {
    return Array.isArray(obj) == false && obj instanceof ATRecord;
  }

  // Helper method that throws an alert displaying the variable passed to it
  #debugVariable(value) {
    alert(JSON.stringify(value));
  }
}

// ***************
// * ATRecord Class
// ***************
class ATRecord {
  constructor(id, data = {}) {
    this.recordID = id;
    this.data = data;

    // Creates a property for each field
    Object.keys(this.data).forEach((method) => {
      const propName = method.replace(/ /g, "");
      Object.defineProperty(this, propName, {
        get: function myProperty() {
          return this.data[method];
        },
        set: function setMyProperty(value) {
          this.data[method] = value;
        },
      });
    });
  }

  static create(record) {
    return new ATRecord(record.id, record.fields);
  }

  get fields() {
    return this.data;
  }

  get id() {
    return this.recordID;
  }

  set id(recordID) {
    this.recordID = recordID;
  }

  addField(name, value) {
    //Field names are created using Capital Case for Airtable compatibility
    name = name.replace(/\w\S*/g, (w) => w.replace(/^\w/, (c) => c.toUpperCase()));
    const propName = name.replace(/ /g, "");
    const propExists = propName in this;

    if (propExists == false) {
      // Creates getter and setter methods for each field added
      Object.defineProperty(this, propName, {
        get: function getMyProperty() {
          return this.data[name];
        },
        set: function setMyProperty(value) {
          this.data[name] = value;
        },
      });
    }
    this.data[name] = value;
  }

  removeField(name) {
    delete this.data[name];
  }

  valueOfField(name) {
    return this.data[name];
  }
}
