require("../Scripts/modules/cp/Statuses.js");
require("../Scripts/shared/libraries/DraftsUI.js");

require("../Scripts/modules/cp/filesystems/TestFS.js");

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
    statusList: [
      "Developing",
      "Drafting",
      "Writing",
      "Editing",
      "Polishing",
      "On Deck",
    ],
  },
};

const ui = new DraftsUI();

const dependencies = {
  ui: ui,
  settings: settings,
  tableName: "Content",
};

const statuses = new Statuses(dependencies);

const selectedStatus = statuses.select();
ui.debugVariable(selectedStatus);
