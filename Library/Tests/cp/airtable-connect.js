require("shared/libraries/DraftsUI.js");
require("modules/cp/databases/AirTableDB.js");
require("modules/cp/records/TestRecentRecords.js");

const id = "recqSJM6WAqfkuSkl";
const docID = "F59242F5-8096-44A6-B8DC-529DA4082AAC";
const recent = new TestRecentRecords();
const ui = new DraftsUI();

const dependencies = {
  ui: ui,
  tableName: "Content",
  settings: {
    airTable: {
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
    },
  },
  recentRecords: recent,
};

const db = new AirTableDB(dependencies);
db.debug = true;

// let record = db.retrieveRecordById(id);
// let record = db.retrieveRecordByField("docID", docID);
const doc = {
  docID: "B3C6CB1B-CD76-4BB5-BAE4-EBAB34A6E5C1",
  docIDType: "DraftsID",
};
doc[record] = db.retrieveRecordByDocID(doc);

if (db.databaseError) {
  ui.displayErrorMessage({
    errorMessage: "Database error! Cannot conintue.",
  });
} else {
  ui.debugVariable(record);
}

// const timeStamp = new Date();
// record.Title = `Fact or Fiction (${timeStamp.toLocaleString()})`;
// record = db.updateUsingDoc(doc);

// record instanceof ATRecord
