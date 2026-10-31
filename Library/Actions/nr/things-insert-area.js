require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/ThingsTags.js");

// Asks which Things area a to-do or project goes in, then types its tag at
// the cursor, e.g. "@area(Sanity)". Areas are listed under `things` in
// nr-settings.yaml.
function insertThingsArea() {
  const { areas, areaMenu } = loadSettings("nr-settings.json").things;
  const ui = new DraftsUI();
  const menuItems = areas.map((area) => ({ type: "button", data: { name: area, value: area } }));

  const menu = ui.buildMenu({ ...areaMenu, menuItems });
  if (!menu.show()) return context.cancel();

  ui.insertAtCursor(ThingsTags.area(menu.buttonPressed));
}

insertThingsArea();
