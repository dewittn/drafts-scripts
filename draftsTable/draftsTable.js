// draftsTables
// A simple script to interact with the Airtable API

// ***************
// * Airtable Class
// ***************
class Airtable {
  constructor(apiKey) {
    this._endPointURL = "https://api.airtable.com/v0/";
    this._authorize();
    //this._baseID = this._baseLookup(baseName);
  }

  base(baseID = this._defaultBaseID) {
    return new ATBase(this, baseID);
  }

  // Setup & Store Credentials
  _authorize() {
    var credential = Credential.create("AirTable", "AirTable API");
    credential.addPasswordField("api_key", "API Key");
    credential.addTextField("baseID", "Default Base ID");
    credential.authorize();
    this._apiKey = credential.getValue("api_key");
    this._defaultBaseID = credential.getValue("baseID");
  }

  // Allows BaseIDs to be stored in an iCloud json file.
  // Default base id is used if no name is specified
  _baseLookup(baseName) {
    if (baseName == "default") {
      return this._defaultBaseID;
    } else {
      // read from file in iCloud
      let fmCloud = FileManager.createCloud(); // Connect to iCloud storage
      let bases = fmCloud.readJSON(this.filesPath + "bases.json");
      return bases[baseName];
    }
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
    const results = this._request({ method: "GET", parameters: params });
    if (results) {
      for (const record of results.records) {
        this._records.push(ATRecord.create(record));
      }
    }
    return this._records;
  }

  find(id) {
    if (id) {
      const result = this._request({ method: "GET" }, id);
      const record = ATRecord.create(result);
      this._records = [record];
      return record;
    }
  }

  // Returns all records by a field value
  findBy(field, value) {
    this._records = [];
    this._params["filterByFormula"] = "{" + field + "} = '" + value + "'";
    let payload = {
      method: "GET",
      parameters: this._params,
    };

    let results = this._request(payload);
    for (const record of results.records) {
      this._records.push(ATRecord.create(record));
    }
    return this._records;
  }

  // Returns a single record by a field value
  findFirstBy(field, value) {
    this._records = [];
    this._params["filterByFormula"] = "{" + field + "} = '" + value + "'";
    const payload = {
      method: "GET",
      parameters: this._params,
    };
    const record = this._request(payload).records[0];
    if (record) {
      return ATRecord.create(record);
    }
    return false;
  }

  // A string containing all the fields to include in the return separated by ,
  // "Title,Status,Priority"
  fields(value) {
    if (!Array.isArray(value)) {
      value = value.split(",");
    }
    for (let i = 0; i < value.length; i++) {
      this._params["fields[" + i + "]"] = value[i];
    }
    return this;
  }

  // A string containing a filter by formula
  filterBy(value) {
    if (typeof value === "string") {
      this._params["filterByFormula"] = value;
    }
    return this;
  }

  //  containing the maximum number of records to return
  maxRecords(value) {
    if (typeof value === "number") {
      value = value.toString();
    }
    if (typeof value === "string") {
      this._params["maxRecords"] = value;
    }
    return this;
  }

  // The number of records returned in each request.
  // Must be less than or equal to 100. Default is 100.
  pageSize(value) {
    if (typeof value === "number") {
      value = value.toString();
    }
    if (typeof value === "string") {
      this._params["pageSize"] = value;
    }
    return this;
  }

  view(vaule) {
    if (typeof value === "string") {
      this._params["view"] = value;
    }
    return this;
  }

  sort(field, direction) {
    const sort = { field: field, direction: direction };
    this._sort.push(sort);
    this._params["sort"] = this._sort;
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
  createRecords(records = this._records, typecast) {
    // Save record;
    var requestBody = new Array();
    if (!Array.isArray(records)) {
      records = [records];
    }
    for (const record of records) {
      requestBody.push({ fields: record.fields });
    }
    const payload = { method: "POST", data: { records: requestBody } };
    return this._request(payload);
  }

  update(records = this._records) {
    var requestBody = new Array();
    if (!Array.isArray(records)) {
      records = [records];
    }
    for (const record of records) {
      requestBody.push({ id: record.id, fields: record.fields });
    }
    var payload = { method: "PATCH", data: { records: requestBody } };
    return this._request(payload);
  }

  // Old Method, generates a request for EACH record.
  // delete(records) {
  //   // var requestBody = new Array();
  //   if (!Array.isArray(records)) {
  //     records = [records];
  //   }
  //   for (const record of records) {
  //     const result = this._request({ method: "DELETE" }, record.id);
  //   }
  // }

  // New method, deletes all records with a single request
  // Record IDs must be stored as HTML arrays and sent as parameters
  // record[0]="",record[1]=""
  delete(records) {
    let requestBody = {};
    if (!Array.isArray(records)) {
      records = [records];
    }
    for (let i = 0; i < records.length; i++) {
      requestBody["records[" + i + "]"] = records[i].id;
    }
    let payload = { method: "DELETE", parameters: requestBody };
    const result = this._request(payload);
  }

  // List all records from a Table
  listAllRecords() {}

  // Calls update() and create()
  saveRecords() {}

  // Debugging function to make sure Parameters are begin set correctly
  returnParameter(key) {
    return this._params[key];
  }

  // ***********
  // "Private" Functions
  // ***********
  _request(payload, id) {
    let results = false;
    let debugMessage = "\n---------\n";
    let url =
      this._airtable._endPointURL + this._base.baseID + "/" + this.URLSafeName;
    if (id) {
      url = url + "/" + id;
    }
    if (this._offset) {
      payload.parameters["offset"] = this._offset;
    }
    debugMessage =
      debugMessage + "Payload: " + JSON.stringify(payload) + "\n\n";

    let request = Object.assign(
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
    let response = http.request(request);
    debugMessage = debugMessage + "URL: " + url + "\n\n";

    if (response.success) {
      // Parse results and record debug info.
      var text = response.responseText;
      results = JSON.parse(text);
      debugMessage = debugMessage + "Reponse:" + text;

      // save offset and clear params once request is complete
      this._offset = results.offset;
      this._params = {};
    } else {
      var errorCode = response.statusCode;
      debugMessage =
        debugMessage +
        errorCode +
        ": " +
        this._checkError(errorCode) +
        "\n" +
        JSON.stringify(payload);
    }
    if (this._debug) {
      console.log(debugMessage);
    }
    return results;
  }

  _checkError(code) {
    var errorCodes = {
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
    //Field names must be in Capital Case for Airtable compatibility
    name = name.replace(/\w\S*/g, (w) =>
      w.replace(/^\w/, (c) => c.toUpperCase())
    );
    const propName = name.replace(/ /g, "");
    Object.defineProperty(this, propName, {
      get: function getMyProperty() {
        return this._fields[name];
      },
      set: function setMyProperty(value) {
        this._fields[name] = value;
      },
    });
    this._fields[name] = value;
  }

  field(name) {
    return this._fields[name];
  }
}
