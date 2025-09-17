// NocoTables by Nelson/Roberto (@dewittn)
// A NocoDB API wrapper for Drafts

// ***************
// * NocoDB Class
// ***************
class NocoDB {
  static endPointURL = "https://app.nocodb.com/api/v2";
  static filesPath = "/Library/Data";

  #apiToken;
  #defaultBaseID;

  constructor(token) {
    this.#apiToken = token;
    this.#authorize();
  }

  get endPointURL() {
    return this.constructor.endPointURL;
  }

  get filesPath() {
    return this.constructor.filesPath;
  }

  get apiToken() {
    return this.#apiToken;
  }

  base(baseID = this.#defaultBaseID) {
    return new NocoBase(this, baseID);
  }

  // Setup & Store Credentials
  #authorize() {
    let credential = Credential.create("NocoDB", "NocoDB API");
    credential.addPasswordField("api_token", "API Token");
    credential.addTextField("baseID", "Default Base ID");
    credential.addTextField("endpoint_url", "Endpoint URL");
    credential.authorize();
    this.#apiToken = credential.getValue("api_token");
    this.#defaultBaseID = credential.getValue("baseID");

    // Use custom endpoint URL if provided, otherwise use default
    const customEndpoint = credential.getValue("endpoint_url");
    if (customEndpoint && customEndpoint.trim() !== "") {
      this.constructor.endPointURL = customEndpoint.trim();
    }
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
// * NocoBase Class
// ***************
class NocoBase {
  #nocodb;
  #baseID;

  constructor(nocodb, baseID) {
    this.#nocodb = nocodb;
    this.#baseID = baseID;
  }

  get baseID() {
    return this.#baseID;
  }

  table(tableID) {
    return new NocoTable(this.#nocodb, this, tableID);
  }
}

// ***************
// * NocoTable Class
// ***************
class NocoTable {
  #nocodb;
  #base;
  #tableID;
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

  constructor(nocodb, base, tableID) {
    this.#nocodb = nocodb;
    this.#base = base;
    this.#tableID = tableID;
  }

  // *******
  // Property Methods
  get records() {
    return this.#records;
  }

  get firstRecord() {
    return this.#records[0];
  }

  get tableID() {
    return this.#tableID;
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
    return this.#nocodb.endPointURL;
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
      this.#params["fields"] = value.join(",");
    }
    return this;
  }

  // A string containing a where condition
  where(value) {
    if (typeof value === "string") this.#params["where"] = value;
    return this;
  }

  //  containing the maximum number of records to return
  limit(value) {
    if (typeof value === "number") value = value.toString();
    if (typeof value === "string") this.#params["limit"] = value;
    return this;
  }

  // The number of records to skip
  offset(value) {
    if (typeof value === "number") value = value.toString();
    if (typeof value === "string") this.#params["offset"] = value;
    return this;
  }

  // View ID to use
  viewId(value) {
    if (typeof value === "string") this.#params["viewId"] = value;
    return this;
  }

  // Sort by field and direction
  // Direction can either be "asc" or "desc"
  sort(field, direction = "asc") {
    if (field == undefined) return;
    this.#params["sort"] = `${field},${direction}`;
    return this;
  }

  // *********
  // GET Functions
  // *********
  select(params = this.#params) {
    const response = this.#makeHTTPRequest({ method: "GET", parameters: params });
    if (response.success) response.data.list.forEach((record) => this.#addRecord(record));

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
    this.#params["where"] = `(${field},eq,${value})`;
    let payload = {
      method: "GET",
      parameters: this.#params,
    };

    const response = this.#makeHTTPRequest(payload);
    if (response.success) response.data.list.forEach((record) => this.#addRecord(record));

    return this.#records;
  }

  // Returns a the first record by a field value
  findFirstByField(field, value) {
    this.#records = [];
    this.#params["where"] = `(${field},eq,${value})`;
    this.#params["limit"] = "1";
    const payload = {
      method: "GET",
      parameters: this.#params,
    };
    const response = this.#makeHTTPRequest(payload);
    if (response.success && response.data.list[0] != undefined) this.#addRecord(response.data.list[0]);

    return this.#records[0];
  }

  // List all records from a Table
  findAllRecords() {
    this.#records = [];
    const payload = {
      method: "GET",
      parameters: this.#params,
    };
    const response = this.#makeHTTPRequest(payload);
    if (response.success) response.data.list.forEach((record) => this.#addRecord(record));

    return this.#records;
  }

  // *********
  // POST Functions
  // *********

  // Create new records in table
  createRecords(records = this.records) {
    if (Array.isArray(records) == false) records = [records];

    const requestBody = records.map((record) => record.fields);
    const payload = { method: "POST", data: requestBody };

    const response = this.#makeHTTPRequest(payload);
    if (response.success) {
      // NocoDB returns created records directly
      if (Array.isArray(response.data)) {
        response.data.forEach((record) => this.#addRecord(record));
      } else {
        this.#addRecord(response.data);
      }
    }

    return response.success;
  }

  // *********
  // PATCH Functions
  // *********

  update(records = this.records) {
    if (Array.isArray(records) == false) records = [records];
    const requestBody = records.map((record) => record.fields);
    const payload = { method: "PATCH", data: requestBody };

    const response = this.#makeHTTPRequest(payload, records[0].id);
    if (response.success) {
      // NocoDB returns updated records directly
      if (Array.isArray(response.data)) {
        response.data.forEach((record) => this.#addRecord(record));
      } else {
        this.#addRecord(response.data);
      }
    }

    return response.success;
  }

  // *********
  // DELETE Functions
  // *********

  // Delete records by ID
  delete(records) {
    if (!Array.isArray(records)) records = [records];

    // For bulk delete, use the bulk delete endpoint
    if (records.length > 1) {
      const ids = records.map(r => r.id);
      const payload = { method: "DELETE", data: ids };
      const response = this.#makeHTTPRequest(payload, "bulk");
      return response.success;
    } else {
      // Single record delete
      const payload = { method: "DELETE" };
      const response = this.#makeHTTPRequest(payload, records[0].id);
      return response.success;
    }
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

    return success;
  }

  // Debugging function to make sure Parameters are begin set correctly
  getParam(key) {
    return this.#params[key];
  }

  // Returns a new record
  newRecord() {
    return new NocoRecord();
  }

  // ***********
  // Private Functions
  // ***********
  #addRecord(data) {
    this.#records.push(NocoRecord.create(data));
  }

  #makeHTTPRequest(payload, id = "") {
    let url = `${this.endPointURL}/tables/${this.tableID}/records`;
    if (id && id !== "bulk") {
      url += `/${id}`;
    } else if (id === "bulk") {
      url = `${this.endPointURL}/tables/${this.tableID}/records/bulk`;
    }

    let debugMessage = `\n---------\nURL: ${url}\n\nPayload: ${JSON.stringify(payload)}`;

    const request = Object.assign(
      {
        url: url,
        headers: {
          "xc-token": this.#nocodb.apiToken,
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

    // Clear params once request is complete
    this.#params = {};

    return results;
  }

  #requestError(response, debugMessage) {
    this.#error = true;
    this.#errorMessage = `NocoDB Error: ${response.statusCode} - ${this.#checkError(response.statusCode)}`;
    app.displayErrorMessage(this.#errorMessage);

    debugMessage = `${debugMessage}\n\n${this.#errorMessage}`;
    if (this.#debug) console.log(debugMessage);

    return false;
  }

  #formatResponseText(text) {
    const formatedTxt = JSON.parse(text);
    return formatedTxt;
  }

  #checkError(code) {
    return this.errorCodes[code];
  }

  #checkForArrayOrRecord(obj) {
    return Array.isArray(obj) == false && obj instanceof NocoRecord;
  }

  // Helper method that throws an alert displaying the variable passed to it
  #debugVariable(value) {
    alert(JSON.stringify(value));
  }
}

// ***************
// * NocoRecord Class
// ***************
class NocoRecord {
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
    return new NocoRecord(record.Id, record);
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
    // Field names are used as-is for NocoDB compatibility
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
