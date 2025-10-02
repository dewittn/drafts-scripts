require("shared/libraries/DraftsUI.js");
require("modules/cp/databases/NocoDB.js");
require("modules/cp/records/TestRecentRecords.js");
require("modules/cp/filesystems/CloudFS.js");

const ui = new DraftsUI({
  draftLogUUID: "F59242F5-8096-44A6-B8DC-529DA4082AAC",
});
ui.debug = true;

const recent = new TestRecentRecords();
const dependencies = {
  ui: ui,
  tableName: "Content",
  settings: {
    nocodb: {
      defaultFields: [
        "Title",
        "Status",
        "Destination",
        "UlyssesID",
        "DraftsID",
        "Slug",
        "Link",
        "docID",
        "docIDType",
      ],
      defaultPriority: "Low",
    },
  },
  recentRecords: recent,
  textUtilities: {
    // Mock text utilities for testing
    removeSpecialCharacters: (text) => text.replace(/[^\w\s]/gi, ""),
    titleCase: (text) =>
      text.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
      ),
  },
};

try {
  ui.displayInfoMessage("Testing NocoDB Connection...");

  const db = new NocoController(dependencies);
  db.debug = true;

  ui.displayInfoMessage("NocoDB instance created successfully");

  // Test 1: Retrieve all records from table
  ui.displayInfoMessage("Test 1: Retrieving all records...");
  const allRecords = db.retrieveRecordsByField("Status", "Writing");

  if (db.databaseError) {
    ui.displayErrorMessage({
      errorMessage: "Database error retrieving records!",
      errorDetails: db.stackTrace,
    });
  } else {
    ui.displayInfoMessage(
      `Found ${allRecords ? allRecords.length : 0} published records`,
    );
    if (allRecords && allRecords.length > 0) {
      ui.debugVariable(
        `First record: ${JSON.stringify(allRecords[0], null, 2)}`,
      );
    }
  }

  // Test 2: Test document lookup
  ui.displayInfoMessage("Test 2: Testing document lookup...");
  const testDoc = {
    docID: "-LtGawLUBaCipsY2l-Ig0A",
    docIDType: "DraftsID",
    title: "StreetXSW",
    status: "Drafting",
  };

  const isInPipeline = db.docIsInPipeline(testDoc);
  ui.displayInfoMessage(`Document in pipeline: ${isInPipeline}`);

  // Test 3: Retrieve specific record if it exists
  if (isInPipeline) {
    ui.displayInfoMessage("Test 3: Retrieving specific document record...");
    const specificRecord = db.retrieveRecordByDocID(testDoc);
    if (specificRecord?.docID == undefined) {
      ui.displayAppMessage(
        "error",
        "Record retrieved but docID is not accessable.",
        specificRecord,
      );
    }
    alert(specificRecord.docID);
    if (db.databaseError) {
      ui.displayErrorMessage({
        errorMessage: "Database error retrieving specific record!",
        errorDetails: db.stackTrace,
      });
    } else {
      ui.debugVariable(specificRecord, `Retrieved record:`);
    }
  }

  ui.displaySuccessMessage("NocoDB connection test completed successfully!");
} catch (error) {
  ui.displayErrorMessage(error, "Test failed with error");
}

script.complete();
