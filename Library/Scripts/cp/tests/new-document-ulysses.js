require("cp/Statuses.js");
require("cp/Destinations.js");
require("cp/RecentRecords.js");
require("cp/ui/DraftsUI.js");
require("cp/documents/document_factory.js");

require("cp/databases/TestDB.js");
require("cp/filesystems/TestFS.js");

const destinationsData = {
  table1: {
    inbox: {
      groupID: "hZ7IX2jqKbVmPGlYUXkZjQ",
    },
    "nr.com": {
      groupID: "_irtj5J8siY8DXj0E4ckmA",
      draftAction: "Show Alert",
      airtableName: "NR.com",
    },
    "coto.studio": {
      groupID: "WgLHy2d17CyYfHPp5YqvKw",
      airtableName: "Coto.Studio",
    },
  },
};

const settings = {
  defaultTag: "In Pipeline",
  statuses: {
    selectStatus: {
      errorMessage: "Error: You must select a status!!",
      menuSettings: {
        menuTitle: "Chose Status:",
        menuMessage: "Please select a status for",
      },
    },
    statusList: [
      "Developing",
      "Drafting",
      "Writing",
      "Editing",
      "Polishing",
      "On Deck",
    ],
  },
  destinations: {
    destinationsFile: "destinations.json",
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
  documentFactory: {
    ulyssesDoc: {
      excerptText: "This is a placeholder for the excerpt!!",
      darftsCallbackData: {
        baseURL: "drafts://x-callback-url/",
        runActionParams: "runAction?action=",
        uuidParams: "&text=",
      },
      piplineLinks: [
        {
          linkText: "Content Pipeline: Update Status",
          actionName: "updateStatusWithUlyssesID",
        },
        {
          linkText: "Content Pipeline: Sync Status",
          actionName: "syncStatusWithUlyssesID",
        },
      ],
    },
  },
};

const record = {
  docID: "6E3CEF3B-2276-45CE-9EC4-9094D93DD4B1",
  docIDType: "DraftsID",
};

const ui = new DraftsUI();
const fileSystem = new TestFS(destinationsData);

const dependencies = {
  ui: ui,
  fileSystem: fileSystem,
  settings: settings,
  tableName: "table1",
};

const statuses = new Statuses(dependencies);
dependencies["statuses"] = statuses;

const dests = new Destinations(dependencies);
dependencies["destinations"] = dests;

const document_factory = new DocumentFactory(dependencies);

// const testDraft = document_factory.load(record);
const testSheet = document_factory.create("sheet");
testSheet.status = "Developing";
testSheet.destination = "inbox";
testSheet.content = "This is a test";

testSheet.save();
