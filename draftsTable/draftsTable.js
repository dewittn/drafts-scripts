// draftsTables by Nelson/Roberto (@dewittn)
// An Airtable API wrapper for Drafts

// ***************
// * Airtable Class
// ***************
class Airtable {
  constructor(apiKey) {
    this._endPointURL = "https://api.airtable.com/v0/";
    this.filesPath = "/Library/Data/";
    this._authorize();
  }

  base(baseID = this._defaultBaseID) {
    return new ATBase(this, baseID);
  }

  // Setup & Store Credentials
  _authorize() {
    let credential = Credential.create("AirTable", "AirTable API");
    credential.addPasswordField("api_key", "API Key");
    credential.addTextField("baseID", "Default Base ID");
    credential.authorize();
    this._apiKey = credential.getValue("api_key");
    this._defaultBaseID = credential.getValue("baseID");
  }

  // Allows BaseIDs to be stored in an iCloud json file.
  // Default base id is used if no name is specified
  _baseLookup(baseName) {
    if (baseName == "default") return this._defaultBaseID;

    // read from file in iCloud
    let fmCloud = FileManager.createCloud(); // Connect to iCloud storage
    const bases = fmCloud.readJSON(this.filesPath + "bases.json");
    return bases[baseName];
  }
}

// ***************
// * ATBase Class
// ***************
class ATBase {
  constructor(airtable, baseID) {
    this._airtable = airtable;
    this._baseID = baseID;
    this.filesPath = "/Library/Data/";
  }

  get baseID() {
    return this._baseID;
  }

  table(tableName) {
    return new ATTable(this._airtable, this, tableName);
  }
}

// ***************
// * ATTable Class
// ***************
class ATTable {
  constructor(airtable, base, tableName) {
    this._airtable = airtable;
    this._base = base;
    this._tableName = tableName;
    this._params = {};
    this._sort = [];
    this._records = [];
    this._offset = null;
    this._debug = false;
  }

  // *******
  // Property Methods
  get records() {
    return this._records;
  }
  get URLSafeName() {
    return this._tableName.replace(" ", "%20");
  }

  get tableName() {
    return this._tableName;
  }

  get params() {
    return this._params;
  }

  get offset() {
    return this._offset;
  }

  set offset(value) {
    this._offset = value;
  }

  get debug() {
    return this._debug;
  }
  set debug(value) {
    this._debug = value;
  }

  // *******
  // Select Methods
  select(params = this._params) {
    const response = this._makeHTTPRequest({ method: "GET", parameters: params });
    if (!response.records) return false;
    response.records.forEach((record) => this._records.push(ATRecord.create(record)));
    return this._records;
  }

  findById(id) {
    const response = this._makeHTTPRequest({ method: "GET", parameters: this._params }, id);
    if (!response) return false;
    return ATRecord.create(response);
  }

  // Returns an array of records by a field value
  findByField(field, value) {
    this._records = [];
    this._params["filterByFormula"] = `{${field}} = '${value}'`;
    let payload = {
      method: "GET",
      parameters: this._params,
    };

    const response = this._makeHTTPRequest(payload);
    if (!response.records) return false;
    response.records.forEach((record) => this._records.push(ATRecord.create(record)));
    return this._records;
  }

  // Returns a the first record by a field value
  findFirstByField(field, value) {
    this._records = [];
    this._params["filterByFormula"] = `{${field}} = '${value}'`;
    const payload = {
      method: "GET",
      parameters: this._params,
    };
    const response = this._makeHTTPRequest(payload);
    if (!response.records || !response.records.length) return false;
    return ATRecord.create(response.records[0]);
  }

  // A string containing all the fields to include in the return separated by ,
  // "Title,Status,Priority"
  fields(value) {
    if (typeof value === "string") value = value.split(",");
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        this._params[`fields[${i}]`] = value[i];
      }
    }
    return this;
  }

  // A string containing a filter by formula
  filterBy(value) {
    if (typeof value === "string") this._params["filterByFormula"] = value;
    return this;
  }

  //  containing the maximum number of records to return
  maxRecords(value) {
    if (typeof value === "number") value = value.toString();
    if (typeof value === "string") this._params["maxRecords"] = value;
    return this;
  }

  // **************************\
  // stopped here

  // The number of records returned in each request.
  // Must be less than or equal to 100. Default is 100.
  pageSize(value) {
    if (typeof value === "number") value = value.toString();
    if (typeof value === "string") this._params["pageSize"] = value;
    return this;
  }

  view(vaule) {
    if (typeof value === "string") this._params["view"] = value;
    return this;
  }

  sort(field, direction) {
    this._sort.push({ field: field, direction: direction });
    this._sort.forEach((sort, i) => {
      this._params[`sort[${i}][field]`] = sort.field;
      this._params[`sort[${i}][direction]`] = sort.direction;
    });
    return this;
  }

  // Returns a new record
  newRecord() {
    return new ATRecord();
  }

  // Adds record that will be saved when createRecords() is called
  addRecord(record) {
    this._records.push(record);
  }

  // Create new records in table
  createRecords(records = this._records, typecast = false) {
    if (!Array.isArray(records)) records = [records];

    const requestBody = records.map((record) => ({ fields: record.fields }));
    const payload = { method: "POST", data: { records: requestBody, typecast: typecast } };
    return this._makeHTTPRequest(payload);
  }

  update(records = this._records) {
    // var requestBody = new Array();
    if (!Array.isArray(records)) records = [records];
    const requestBody = records.map((record) => ({ id: record.id, fields: record.fields }));
    var payload = { method: "PATCH", data: { records: requestBody } };
    return this._makeHTTPRequest(payload);
  }

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
    const result = this._makeHTTPRequest(payload);
  }

  // Old Method, generates a request for EACH record.
  // delete(records) {
  //   // var requestBody = new Array();
  //   if (!Array.isArray(records)) {
  //     records = [records];
  //   }
  //   for (const record of records) {
  //     const result = this._makeHTTPRequest({ method: "DELETE" }, record.id);
  //   }
  // }

  // List all records from a Table
  findAllRecords() {}

  // Calls update() and create()
  saveRecords(records) {
    const recordsToUpdate = records
      .map((record) => {
        if (record.id) return record;
      })
      .filter(Boolean);
    const recordsToCreate = records
      .map((record) => {
        if (!record.id) return record;
      })
      .filter(Boolean);

    let updateResult, createResult;
    if (recordsToUpdate?.length) updateResult = this.update(recordsToUpdate);
    if (recordsToCreate?.length) createResult = this.createRecords(recordsToCreate);
    return updateResult || createResult ? true : false;
  }

  // Debugging function to make sure Parameters are begin set correctly
  returnParameter(key) {
    return this._params[key];
  }

  // ***********
  // "Private" Functions
  // ***********
  _makeHTTPRequest(payload, id = "") {
    let results = false;
    const url = `${this._airtable._endPointURL}${this._base.baseID}/${this.URLSafeName}/${id}`;
    if (this._offset) payload.parameters["offset"] = this._offset;

    let debugMessage = `\n---------\nURL: ${url}\n\nPayload: ${JSON.stringify(payload)}\n\n`;

    const request = Object.assign(
      {
        url: url,
        headers: {
          Authorization: "Bearer " + this._airtable._apiKey,
          "Content-Type": "application/json",
        },
      },
      payload
    );
    let http = HTTP.create();
    const response = http.request(request);

    if (response.success) {
      // Parse results and record debug info.
      let text = response.responseText;
      results = JSON.parse(text);
      debugMessage = debugMessage + `Reponse: ${text}`;

      // save offset and clear params once request is complete
      this._offset = results.offset;
      this._params = {};
    } else {
      debugMessage =
        debugMessage + response.statusCode + `: ${this._checkError(response.statusCode)}\n${JSON.stringify(payload)}`;
    }
    if (this._debug) console.log(debugMessage);
    return results;
  }

  _checkError(code) {
    const errorCodes = {
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
    return errorCodes[code];
  }

  // Helper method that throws an alert displaying the variable passed to it
  _debugVariable(value) {
    alert(JSON.stringify(value));
  }
}

// ***************
// * ATRecord Class
// ***************
class ATRecord {
  constructor(id, fields = {}) {
    this._id = id;
    this._fields = fields;
    // Creates a property for each field
    Object.keys(this._fields).forEach((method) => {
      const propName = method.replace(/ /g, "");
      Object.defineProperty(this, propName, {
        get: function myProperty() {
          return this._fields[method];
        },
        set: function setMyProperty(value) {
          this._fields[method] = value;
        },
      });
    });
  }

  static create(record) {
    return new ATRecord(record.id, record.fields);
  }

  get fields() {
    return this._fields;
  }

  get id() {
    return this._id;
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
          return this._fields[name];
        },
        set: function setMyProperty(value) {
          this._fields[name] = value;
        },
      });
    }
    this._fields[name] = value;
  }

  valueOfField(name) {
    return this._fields[name];
  }
}
