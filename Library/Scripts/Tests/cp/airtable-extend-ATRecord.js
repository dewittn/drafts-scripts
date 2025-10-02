require("../../modules/cp/ui/DraftsUI.js");
require("../../modules/cp/databases/AirTableDB.js");
require("../../modules/cp/records/TestRecentRecords.js");

const id = "recqSJM6WAqfkuSkl";
const recent = new TestRecentRecords();
const ui = new DraftsUI();

const dependencies = {
  ui: ui,
  tableName: "Test Table",
  settings: {
    settings: {
      defaultFields: [
        "Title",
        "Status",
        "Destination",
        "UlyssesID",
        "DraftsID",
        "Slug",
        "Link",
      ],
    },
    recentRecords: recent,
  },
};

const db = new AirTableDB(dependencies);
db.debug = true;

let record = db.retrieveRecordById(id);

ui.debugVariable(record.docID);

// record instanceof ATRecord
