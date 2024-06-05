require("cp/Statuses.js");
require("cp/ui/DraftsUI.js");

require("cp/filesystems/TestFS.js");

const settings = {
  statuses: {
    selectStatus: {
      menuSettings: {
        menuTitle: "Select Content",
        menuMessage: "Please pick status",
        menuItems: [
          {
            type: "button",
            data: {
              name: "<< Back",
              value: "selectContentByStatus",
              isDefault: true,
            },
          },
        ],
      },
      menuPicker: {
        name: "recrodIndex",
        label: "",
      },
    },
    statusList: ["Developing", "Drafting", "Writing", "Editing", "Polishing", "On Deck"],
  },
};

const ui = new DraftsUI();

const dependancies = {
  ui: ui,
  settings: settings,
  tableName: "Content",
};

const statuses = new Statuses(dependancies);

const selectedStatus = statuses.select();
ui.debugVariable(selectedStatus);
