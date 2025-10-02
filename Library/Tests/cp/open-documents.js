require("../Scripts/modules/cp/Statuses.js");
require("../Scripts/modules/cp/Destinations.js");
require("../Scripts/shared/libraries/DraftsUI.js");
require("../Scripts/modules/cp/documents/document_factory.js");
require("../Scripts/modules/cp/filesystems/TestFS.js");

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
    "Beyond The Book": {
      groupID: "82Du-mNX2qy1GvPSQ3I8xA",
      airtableName: "Coto.Studio",
    },
  },
};

const settings = {
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
  defaultTag: "In Pipeline",
  documentFactory: {
    ulyssesDoc: {},
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

const draftID = "1C082565-0E6A-4020-8C5E-925F078DFC27";
const ulyssesID = "Ml5MfJiXCQLK-MVoxjB-Iw";
const ui = new DraftsUI();
const fileSystem = new TestFS(destinationsData);

const dependencies = {
  tableName: "table1",
  ui: ui,
  fileSystem: fileSystem,
  settings: settings,
};

const statuses = new Statuses(dependencies);
dependencies["statuses"] = statuses;

const dests = new Destinations(dependencies);
dependencies["destinations"] = dests;

const document_factory = new DocumentFactory(dependencies);

// const doc1 = document_factory.load({ docIDType: "DraftsID", docID: draftID });
const doc2 = document_factory.load({
  docIDType: "UlyssesID",
  docID: ulyssesID,
});

// doc1.open();
doc2.open();
