require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/ThingsTags.js");

// Asks when a to-do or project should start, then types its @when tag at the
// cursor. The picked time is used only when Create reminder is on. The prompt
// is `things.whenMenu` in nr-settings.yaml.
function insertThingsWhen() {
  const { whenMenu } = loadSettings("nr-settings.json").things;
  const ui = new DraftsUI();

  const menu = ui.buildMenu(whenMenu);
  if (!menu.show()) return context.cancel();

  const { when, reminder } = menu.fieldValues;
  ui.insertAtCursor(ThingsTags.when(when, reminder));
}

insertThingsWhen();
