require("shared/libraries/DraftsUI.js");
require("modules/cp/templates/Template.js");

const ui = new DraftsUI();
ui.debug = true;
const templateFile = "nr/items-to-pack.md";
const menuSettings = {
  menuTitle: "Prepare for a trip.",
  menuMessage: "Fill out these details about your trip:",
  menuItems: [
    { type: "textField", data: { name: "destination", label: "Destination" } },
    {
      type: "datePicker",
      data: {
        name: "depature",
        label: "Depature Date:",
        options: { mode: "date" },
      },
    },
    {
      type: "button",
      data: { name: "Create in Things", value: "create", isDefault: true },
    },
    { type: "button", data: { name: "Modify first", value: "modify" } },
  ],
};

const tripPrompt = ui.buildMenu(menuSettings);
if (tripPrompt.show()) createTemplate();

function createTemplate() {
  const destination = tripPrompt.fieldValues["destination"];
  const departureDate = tripPrompt.fieldValues["depature"];
  const deadline = adjustDate(departureDate, "-1 day");

  const packingList = new Template({
    templateFile: "nr/items-to-pack.md",
    templateTags: {
      destination: destination,
      deadline: formatDate(deadline),
    },
    draftTags: ["things"],
  });

  if (tripPrompt.buttonPressed == "modify") return packingList.save();

  const thingsParserAction = Action.find("Things Parser");
  app.queueAction(thingsParserAction, packingList.draft);
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
