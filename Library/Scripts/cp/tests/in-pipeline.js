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
    draftsDoc: {
      createNewDraft: {
        infoMessage: "Draft cannot be added without a destination!",
        errorMessage: "Error: Draft could not be added to the Pipeline!",
        successMessage: "Success! Darft added to the Pipeline",
        menuSettings: {
          menuTitle: "Working title?",
          menuMessage:
            "Please enter a working title for your draft (no markdown):",
          menuItems: [
            {
              type: "button",
              data: {
                name: "Developing",
                value: "Developing",
                isDefault: true,
              },
            },
            {
              type: "button",
              data: {
                name: "Drafting",
                value: "Drafting",
              },
            },
            {
              type: "textField",
              data: {
                name: "workingTitle",
                label: "",
                initialText: "",
              },
            },
          ],
        },
      },
    },
  },
};

const record = {
  docID: "B3C6CB1B-CD76-4BB5-BAE4-EBAB34A6E5C1",
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

const testDraft = document_factory.load(record);

ui.debugVariable(testDraft.inPipeline);
