require("cp/ui/DraftsUI.js");
require("cp/databases/AirTableDB.js");
require("cp/records/TestRecentRecords.js");

const id = "recqSJM6WAqfkuSkl";
const recent = new TestRecentRecords();
const ui = new DraftsUI();

const dependancies = {
  ui: ui,
  tableName: "Test Table",
  settings: {
    settings: {
      defaultFields: ["Title", "Status", "Destination", "UlyssesID", "DraftsID", "Slug", "Link"],
    },
    recentRecords: recent,
  },
};

const db = new AirTableDB(dependancies);
db.debug = true;

let record = db.retrieveRecordById(id);

ui.debugVariable(record.docID);

// record instanceof ATRecord
