require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/WhatsForLunch.js");

// Shows today's lunch from the week's menu, or opens the menu on a weekend.
// Settings are under `whatsForLunch` in nr-settings.yaml.
const settings = loadSettings("nr-settings.json");
new WhatsForLunch(settings.whatsForLunch, new DraftsUI()).show();
