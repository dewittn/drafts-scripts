# draftsTable

A simple way to interact with the Airtable API.

> Still a work in progress.

### Example: Listing all records in a table

```
let table = new Airtable("Base Name", "Table Name");

// Set query params
table.maxRecords("5");
table.filterBy("{Status} = 'Done'");
table.fields("Title,Status,UlyssesID,Priority");

// Fetch data
var data = table.listRecords();
```
