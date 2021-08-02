// draftsTable v0.1
class Airtable {
  constructor(tableName, baseName = "default") {
    this._authorize();
    this.endPointURL = "https://api.airtable.com/v0/";
    // The `/` path corresponds to the `Drafts` folder in iCloud
    this.filesPath = "/";
    this.baseID = this._baseLookup(baseName);
    this.tableName = tableName;
    this.parameters = {};
    this.records = [];
    this.testRecord = {};
  }

  addParameter(key, value) {
    this.parameters[key] = value;
  }

  // Debugging function to make sure Parameters are begin set correctly
  returnParameter(param) {
    return this.parameters[param];
  }

  // A string containing all the fields to include in the return separated by ,
  // "Title,Status,Priority"
  fields(value) {
    this.addParameter("Fields[]", value);
  }

  // A string containing a filter by formula
  filterBy(value) {
    this.addParameter("filterByFormula", value);
  }

  // String containing the maximum number of records to return
  maxRecords(value) {
    this.addParameter("maxRecords", value);
  }

  // The number of records returned in each request. Must be less than or equal to 100. Default is 100.
  pageSize(value) {
    this.addParameter("pageSize", value);
  }

  // A string to set the sort value
  sort(vaule) {
    this.addParameter("sort", value);
  }

  view(vaule) {
    this.addParameter("view", value);
  }

  // List all records from a Table
  listRecords() {
    // Create URL
    var url = this.endPointURL + this.baseID + "/" + this.tableName;
    var http = HTTP.create(); // create HTTP object
    var response = http.request({
      url: url,
      method: "GET",
      parameters: this.parameters,
      headers: {
        Authorization: "Bearer " + this.api_key,
      },
    });
    //console.log(response);

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

  // Adds record that will be saved when createRecords() is called
  addRecord(data) {
    var record = { fields: data };
    this.records.push(record);
  }

  // Create new records in table
  createRecords() {
    // Create URL
    var url = this.endPointURL + this.baseID + "/" + this.tableName;
    var http = HTTP.create(); // create HTTP object
    var response = http.request({
      url: url,
      method: "POST",
      data: {
        records: this.records,
      },
      headers: {
        Authorization: "Bearer " + this.api_key,
        //"Content-Type": "application/json",
      },
    });

    if (response.success) {
      console.log(response.statusCode);
      console.log(response.responseText);
      console.log(response.responseData);
      console.log(response.error);
      var text = response.responseText;
      var data = response.responseData;
      var results = JSON.parse(text);
    } else {
      console.log(response.statusCode);
      console.log(response.error);
    }
  }

  // Setup & Store Credentials
  _authorize() {
    var credential = Credential.create("AirTable", "AirTable API");
    credential.addPasswordField("api_key", "API Key");
    credential.addTextField("baseID", "Default Base ID");
    credential.authorize();
    this.api_key = credential.getValue("api_key");
    this.baseID = credential.getValue("baseID");
  }

  // Allows BaseIDs to be stored in an icloud json file.
  // Default base id is used if no name is specified
  _baseLookup(baseName) {
    if (baseName == "default") {
      return this.defaultBaseID;
    } else {
      // read from file in iCloud
      let fmCloud = FileManager.createCloud(); // Connect to iCloud storage
      let bases = fmCloud.readJSON(this.filesPath + "bases.json");
      return bases[baseName];
    }
  }
}
