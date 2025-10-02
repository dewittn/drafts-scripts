require("../Scripts/modules/cp/Destinations.js");
require("../Scripts/modules/cp/RecentRecords.js");
require("../Scripts/modules/cp/ui/DraftsUI.js");
require("../Scripts/modules/cp/documents/document_factory.js");

require("../Scripts/modules/cp/filesystems/TestFS.js");
require("../Scripts/modules/cp/databases/TestDB.js");

const testData = {
  table1: [
    {
      id: "recth9aey4kt3G7ll",
      fields: {
        Title: "Why I'm calling my book a Novel",
        docID: "Ml5MfJiXCQLK-MVoxjB-Iw",
        docIDType: "TestID",
        Updated: "2023-09-05T11:09:19.499Z",
      },
    },
    {
      id: "rec8E1RTeMWMRLlOy",
      fields: {
        Title: "Content Site vs Portfolio Site",
        Updated: "2023-09-04T23:38:06.646Z",
        docID: "6E3CEF3B-2276-45CE-9EC4-9094D93DD4B1",
        docIDType: "TestID",
      },
    },
  ],
  table2: [
    {
      id: "recKoX7qXygnChCdL",
      fields: {
        Title: "My Creative process:",
        docID: "ax450SUXgWvL0YFvstD6OA",
        docIDType: "TestID",
        Updated: "2022-08-06T16:49:26.612Z",
      },
    },
    {
      id: "reciSQ27kPaVCOxDm",
      fields: {
        Title: "You are one of the disappeared?",
        docID: "fugUu0N3TxAG16Icg18BgA",
        docIDType: "TestID",
        Updated: "2022-08-05T16:50:43.820Z",
      },
    },
  ],
};

const destinationsData = {
  table1: {
    inbox: {
      groupID: "hZ7IX2jqKbVmPGlYUXkZjQ",
      draftAction: "",
    },
    "nr.com": {
      groupID: "_irtj5J8siY8DXj0E4ckmA",
      draftAction: "",
      airtableName: "NR.com",
    },
    "coto.studio": {
      groupID: "WgLHy2d17CyYfHPp5YqvKw",
      draftAction: "",
      airtableName: "Coto.Studio",
    },
  },
};

const settings = {
  recentDocsFile: "destinations.json",
  destinations: {
    errorMessage: "Error: You must select a destination!!",
    menuPicker: {
      name: "destination",
      label: "Destination",
    },
    menuSettings: {
      menuTitle: "Chose destination:",
      menuMessage: "Please select a destination for",
      isCancellable: false,
      menuItems: [{ type: "button", data: { name: "Ok", value: "ok" } }],
    },
  },
};

const ui = new DraftsUI();
ui.debug = true;
const fileSystem1 = new TestFS(destinationsData);
const fileSystem2 = new TestFS(testData);
const database = new TestDB(testData["table1"]);

const dependencies = {
  ui: ui,
  batabase: database,
  fileSystem: fileSystem1,
  settings: settings,
  tableName: "table1",
};

const dests = new Destinations(dependencies);

dependencies["destinations"] = dests;
dependencies["fileSystem"] = fileSystem2;

const recentDocs = new RecentRecords(dependencies);

const secondRecord = new RecentRecord(recentDocs.records[1]);

const document_factory = new DocumentFactory(dependencies);

const doc = document_factory.load(secondRecord);

const saved = recentDocs.save(doc);
const firstRecord = new RecentRecord(recentDocs.records[0]);

if (firstRecord.docID == secondRecord.docID) {
  ui.displayAppMessage("success", "Recent Records were saved correctly!");
}

