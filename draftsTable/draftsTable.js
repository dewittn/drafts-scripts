// Airtable API v0.1
// Simple interface to interact with Airtable

// Example
// var Airtable = require('airtable');
// var base = new Airtable({apiKey: 'YOUR_API_KEY'}).base('appawXyA4nkuMtT0U');

// ***************
// * Airtable Class
// ***************
class Airtable {
  constructor(apiKey) {
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
    this._endPointURL = "https://api.airtable.com/v0/";
    this._airtable = airtable;
    this._base = base;
    this._tableName = tableName;
    this._params = {};
    this._sort = [];
    this._records = [];
  }

  get URLSafeName() {
    return this._tableName.replace(" ", "%20");
  }

  get tableName() {
    return this._tableName;
  }

  select(params = this._params) {
    var results = this._request("GET", params);
    for (const record of results.records) {
      this._records.push(ATRecord.create(record));
    }
    return this._records;
  }

  find(id) {
    // ??
  }

  // A string containing all the fields to include in the return separated by ,
  // "Title,Status,Priority"
  fields(value) {
    if (typeof value === "array") {
      value = value.toString();
    }
    if (typeof value === "string") {
      this._params["Fields[]"] = value;
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

  // The number of records returned in each request. Must be less than or equal to 100. Default is 100.
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

  // List all records from a Table
  listAllRecords() {}

  // Adds record that will be saved when createRecords() is called
  addRecord(record) {
    this._records.push(record.fields);
  }

  saveRecords(typecast) {
    // Save record;
  }

  // Create new records in table
  createRecords() {}

  // Debugging function to make sure Parameters are begin set correctly
  returnParameter(key) {
    return this._params[key];
  }

  _request(method, params) {
    // Create URL
    var url = this._endPointURL + this._base.baseID + "/" + this.URLSafeName;
    var http = HTTP.create(); // create HTTP object
    var response = http.request({
      url: url,
      method: method,
      parameters: params,
      headers: {
        Authorization: "Bearer " + this._airtable._apiKey,
      },
    });
    console.log(url, response);

    if (response.success) {
      var text = response.responseText;
      var data = response.responseData;
      var results = JSON.parse(text);
    } else {
      console.log(response.statusCode);
      console.log(response.error);
    }
    return results;
  }

  //   _checkError(code) {
  //     var errorCodes = {
  //       400: "Bad Request",
  //       401: "Unauthorized",
  //       402: "Payment Required",
  //       403: "Forbidden",
  //       404: "Not Found",
  //       413: "Request Entity Too Large",
  //       422: "Invalid Request",
  //       500: "Internal Server Error",
  //       502: "Bad Gateway",
  //       503: "Service Unavailable",
  //     };
  //     return errorCodes[code];
  //   }
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
      Object.defineProperty(this, method, {
        get: function myProperty() {
          return this._fields[method];
        },
      });
    });
  }

  get fields() {
    return this._fields;
  }

  addField(name, value) {
    this._fields[name] = value;
  }

  field(name) {
    return this._fields[name];
  }

  static create(record) {
    return new ATRecord(record.id, record.fields);
  }
}
