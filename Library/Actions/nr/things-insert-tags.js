require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/ThingsTags.js");

// Lists the common Things tags with checkmarks, then types the ones picked at
// the cursor, e.g. "@tags(Chore, Easy)". Tags are listed under `things` in
// nr-settings.yaml.
function insertThingsTags() {
  const { tags, tagMenu } = loadSettings("nr-settings.json").things;
  const ui = new DraftsUI();
  const menuItems = [
    { type: "select", data: { name: "tags", label: "", values: tags, allowMultiple: true } },
    { type: "button", data: { name: "Insert", value: "insert", isDefault: true } },
  ];

  const menu = ui.buildMenu({ ...tagMenu, menuItems });
  if (!menu.show()) return context.cancel();

  const picked = ThingsTags.tags(menu.fieldValues.tags);
  if (picked == null) return context.cancel("No tags picked");

  ui.insertAtCursor(picked);
}

insertThingsTags();
