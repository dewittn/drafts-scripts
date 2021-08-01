// draftsTable v0.1
class Airtable {
  constructor(baseName, tableName) {
    this.baseLookup = {
      //"My Table": "wXyA4nkuMtT0U",
    };
    this.endPointURL = "https://api.airtable.com/v0/";
    this.baseID = this.baseLookup[baseName];
    this.tableName = tableName;
    this.parameters = {};
    this.records = [];
    this._authorize();
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
    credential.addTextField("baseID", "Base ID");
    credential.authorize();
    this.api_key = credential.getValue("api_key");
    //this.baseID = credential.getValue("baseID");
  }
}

// Old Code
function airTableReadData(fields, filter, maxRecords, view) {
  // Basic variables
  var endpoint = "https://api.airtable.com/v0/";
  var testData = {
    records: [
      {
        id: "rec7j1okh61sUqMy1",
        fields: {
          UlyssesID: "VJ6rT9dJdrW2BYk2unta4A",
          Status: "Writing",
          Title: "Ghost: Customer Support Engineer",
        },
        createdTime: "2021-07-28T11:36:02.000Z",
      },
      {
        id: "recPxTZe69Kd5VTIE",
        fields: {
          Status: "Writing",
          Title:
            "Perchance to Dream, Stories about living a life detached from reality",
        },
        createdTime: "2021-07-28T10:26:09.000Z",
      },
      {
        id: "reclcZoMA95nCxNFX",
        fields: { Status: "Writing", Title: "Fact or Fiction" },
        createdTime: "2021-07-28T10:26:09.000Z",
      },
      {
        id: "recoew3RZl5LHipse",
        fields: { Status: "Writing", Title: "What to cut, what to keep" },
        createdTime: "2021-07-28T10:26:09.000Z",
      },
    ],
  };

  // Setup & Store Credentials
  var credential = Credential.create("AirTable", "AirTable API");
  credential.addPasswordField("api_key", "API Key");
  credential.addTextField("baseID", "Base ID");
  credential.authorize();
  var secret = credential.getValue("api_key");
  var baseID = credential.getValue("baseID");

  // Create URL
  url = endpoint + baseID + "/Content";
  var http = HTTP.create(); // create HTTP object
  var params = {
    maxRecords: maxRecords,
    filterByFormula: filter,
    "Fields[]": fields,
    view: view,
  };
  var response = http.request({
    url: url,
    method: "GET",
    parameters: params,
    headers: {
      Authorization: "Bearer " + secret,
    },
  });

  console.log(response);

  if (response.success) {
    var text = response.responseText;
    var data = response.responseData;
    var results = JSON.parse(text);
  } else {
    console.log(response.statusCode);
    console.log(response.error);
  }

  return results;
  //return testData;
}
