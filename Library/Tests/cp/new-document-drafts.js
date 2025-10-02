require("../Scripts/modules/cp/Statuses.js");
require("../Scripts/modules/cp/ui/DraftsUI.js");
require("../Scripts/modules/cp/Destinations.js");
require("../Scripts/modules/cp/RecentRecords.js");
require("../Scripts/modules/cp/TextUtilities.js");
require("../Scripts/modules/cp/documents/document_factory.js");
require("../Scripts/modules/cp/templates/template_factory.js");

require("../Scripts/modules/cp/databases/TestDB.js");
require("../Scripts/modules/cp/filesystems/TestFS.js");
require("../Scripts/modules/cp/filesystems/CloudFS.js");

const destinationsData = {
  table1: {
    inbox: {
      groupID: "hZ7IX2jqKbVmPGlYUXkZjQ",
    },
    "Author Update": {
      groupID: "_irtj5J8siY8DXj0E4ckmA",
      draftAction: "Show Alert",
      airtableName: "Newsletter",
      template: "authorUpdate",
    },
    "Beyond The Book": {
      groupID: "WgLHy2d17CyYfHPp5YqvKw",
      airtableName: "Coto.Studio",
      template: "beyondTheBook",
      scrubText: "Beyond The Book: ",
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
  docID: "6E3CEF3B-2276-45CE-9EC4-9094D93DD4B1",
  docIDType: "DraftsID",
};

const ui = new DraftsUI();
ui.debug = true;

const fileSystem = new TestFS(destinationsData);
const textUltilities = new TextUltilities();

const dependencies = {
  ui: ui,
  fileSystem: fileSystem,
  settings: settings,
  tableName: "table1",
  textUltilities: textUltilities,
};

const statuses = new Statuses(dependencies);
dependencies["statuses"] = statuses;

const dests = new Destinations(dependencies);
dependencies["destinations"] = dests;

const document_factory = new DocumentFactory(dependencies);

// const testDraft = document_factory.load(record);
const testDraft = document_factory.create("draft");

ui.debugVariable(testDraft);
