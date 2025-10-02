require("shared/libraries/DraftsUI.js");
require("modules/cp/templates/Template.js");

const ui = new DraftsUI();
ui.debug = true;
const templateFile = "cp/application.md";
const menuSettings = {
  menuTitle: "Select Due Date",
  menuMessage: "Please select the due date for this application:",
  menuItems: [
    {
      type: "datePicker",
      data: {
        name: "dueDate",
        label: "date:",
        initialDate: new Date(),
        options: { mode: "date" },
      },
    },
    {
      type: "button",
      data: { name: "Select", value: "select", isDefault: true },
    },
  ],
};

function createTemplate() {
  const dueDate = datePrompt.fieldValues["dueDate"];

  const application = new Template({
    templateFile: templateFile,
    templateTags: {
      due_date: formatDate(dueDate),
    },
    draftTags: ["application"],
  });

  application.save().activate();
}

function formatDate(date) {
  var d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
}

const datePrompt = ui.buildMenu(menuSettings);
if (datePrompt.show()) createTemplate();
