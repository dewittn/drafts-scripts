require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/LunchReminders.js");

// Adds "pack containers" to-dos in Things for the school days picked from the
// week's lunch menu. Settings are under `lunchReminders` in nr-settings.yaml.
const settings = loadSettings("nr-settings.json");
new LunchReminders(settings.lunchReminders, new DraftsUI()).create();
