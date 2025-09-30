require("cp/Destinations.js");
require("cp/ui/DraftsUI.js");

require("cp/filesystems/TestFS.js");

const settings = {
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
};

const destData = {
  Content: {
    inbox: {
      groupID: "hZ7IX2jqKbVmPGlYUXkZjQ",
    },
    "nr.com": {
      groupID: "_irtj5J8siY8DXj0E4ckmA",
      airtableName: "NR.com",
    },
    storytelling: {
      groupID: "f61KZwMNx4207TcoS8U8cg",
      airtableName: "Storytelling",
    },
    newsletter: {
      groupID: "HUC3AgEJ-StgJgUChjo51g",
      draftAction: "Author Update",
      airtableName: "Newsletter",
    },
  },
};

const ui = new DraftsUI();
const fs = new TestFS(destData);

const dependencies = {
  ui: ui,
  fileSystem: fs,
  settings: settings,
  tableName: "Content",
};

const destinations = new Destinations(dependencies);

const selectedDest = destinations.select();
ui.debugVariable(selectedDest);
