require("cp/Statuses.js");
require("cp/Destinations.js");
require("cp/RecentRecords.js");
require("cp/TextUtilities.js");
require("cp/ui/DraftsUI.js");
require("cp/documents/document_factory.js");

require("cp/databases/TestDB.js");
require("cp/filesystems/TestFS.js");

const destinationsData = {
  table1: {
    inbox: {
      groupID: "TeSuU_iiO34xep0iJh1Y_w",
    },
    "nr.com": {
      groupID: "bXiakMoD-YIoezcRDpXAgg",
      draftAction: "Show Alert",
      airtableName: "NR.com",
    },
    "coto.studio": {
      groupID: "CVxnVTM9Zn-mbxkoeqNPcA",
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
    statusList: ["Developing", "Drafting", "Writing", "Editing", "Polishing", "On Deck"],
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
          menuMessage: "Please enter a working title for your draft (no markdown):",
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
    ulyssesDoc: {
      excerptText: "This is a placeholder for the excerpt!!",
      darftsCallbackData: {
        baseURL: "drafts://x-callback-url/",
        runActionParams: "runAction?action=",
        uuidParams: "&text=",
      },
      piplineLinks: [
        { linkText: "Content Pipeline: Update Status", actionName: "updateStatusWithUlyssesID" },
        { linkText: "Content Pipeline: Sync Status", actionName: "syncStatusWithUlyssesID" },
      ],
    },
  },
};

const ui = new DraftsUI();
const fileSystem = new TestFS(destinationsData);
const textUltilities = new TextUltilities();

const dependancies = {
  ui: ui,
  fileSystem: fileSystem,
  settings: settings,
  tableName: "table1",
  textUltilities: textUltilities,
};

const statuses = new Statuses(dependancies);
dependancies["statuses"] = statuses;

const dests = new Destinations(dependancies);
dependancies["destinations"] = dests;

const document_factory = new DocumentFactory(dependancies);
const timeCode = new Date().toString();
const testDraft = new Draft();

testDraft.addTag(settings.defaultTag);
testDraft.addTag("Writing");
testDraft.addTag("Inbox");
testDraft.content = `# Testing Covert Draft to Sheet\n\nThis is a test draft created: ${timeCode}.\n\n And [this is a markdown link](https://www.google.com).`;
testDraft.update();

const record = { docID: testDraft.uuid, docIDType: "DraftsID" };

let activeDoc = document_factory.load(record);
activeDoc.inPipeline = true;

// Create New Doc
const newDoc = document_factory.create("sheet");
newDoc.status = activeDoc.status;
newDoc.destination = activeDoc.destination;
newDoc.content = activeDoc.content;
newDoc.save();

// Save new doc
newDoc.record = record;
alert(newDoc.docID);
alert(JSON.stringify(record));
alert(JSON.stringify(newDoc.record));

// Delete old doc and update activeDoc
activeDoc.delete();
// activeDoc = newDoc;
