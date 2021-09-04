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
  }

  get records() {
    return this._records;
  }
  get URLSafeName() {
    return this._tableName.replace(" ", "%20");
  }

  get tableName() {
    return this._tableName;
  }

  select(params = this._params) {
    const results = this._request("GET", params);
    for (const record of results.records) {
      this._records.push(ATRecord.create(record));
    }
    return this._records;
  }

  find(id) {
    if (id) {
      const result = this._request("GET", {}, id);
      const record = ATRecord.create(result);
      this._records = [record];
      return record;
    }
  }

  findBy(field, value) {
    const results = this._request("GET", {
      filterByFormula: "{" + field + "} = '" + value + "'",
    });
    for (const record of results.records) {
      this._records.push(ATRecord.create(record));
    }
    return this._records;
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
    this._records.push(record);
  }

  saveRecords(typecast) {
    // Save record;
    var requestBody = new Array();
    for (const record of this._records) {
      requestBody.push({ fields: record.fields });
    }
    var values = JSON.stringify(requestBody);
    // alert(values);
    const result = this._request("POST", {}, undefined, {
      records: requestBody,
    });
  }

  // Create new records in table
  createRecords() {}

  // Debugging function to make sure Parameters are begin set correctly
  returnParameter(key) {
    return this._params[key];
  }

  _request(method, params, id, data) {
    var url =
      this._airtable._endPointURL + this._base.baseID + "/" + this.URLSafeName;
    if (id) {
      url = url + "/" + id;
    }
    console.log(JSON.stringify(data));
    var http = HTTP.create();
    var response = http.request({
      url: url,
      method: method,
      parameters: params,
      data: data,
      headers: {
        Authorization: "Bearer " + this._airtable._apiKey,
        "Content-Type": "application/json",
      },
    });
    console.log(url);

    if (response.success) {
      var text = response.responseText;
      var data = response.responseData;
      var results = JSON.parse(text);
      console.log(text);
      console.log(data);
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
      const propName = method.replace(/ /g, "");
      Object.defineProperty(this, propName, {
        get: function myProperty() {
          return this._fields[method];
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

  addField(name, value) {
    //Field names must be in Capital Case for Airtable compatibility
    name = name.replace(/\w\S*/g, (w) =>
      w.replace(/^\w/, (c) => c.toUpperCase())
    );
    this._fields[name] = value;
  }

  field(name) {
    return this._fields[name];
  }
}
