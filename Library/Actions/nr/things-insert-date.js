require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/ThingsTags.js");

// Asks for a date, then types it at the cursor as @when (Create when, the
// default) or @due (Create due). The picked time is used only for @when with
// Create reminder on. The prompt is `things.dateMenu` in nr-settings.yaml.
function insertThingsDate() {
  const { dateMenu } = loadSettings("nr-settings.json").things;
  const ui = new DraftsUI();

  const menu = ui.buildMenu(dateMenu);
  if (!menu.show()) return context.cancel();

  const { date, reminder } = menu.fieldValues;
  const tagFor = {
    when: () => ThingsTags.when(date, reminder),
    due: () => ThingsTags.due(date),
  };
  ui.insertAtCursor(tagFor[menu.buttonPressed]());
}

insertThingsDate();
