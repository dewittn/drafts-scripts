require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/ShortLinks.js");

// Refreshes the local short link cache with every link on Kutt.
function syncKuttLinks() {
  const settings = loadSettings("nr-settings.json").kutt;
  new ShortLinks(settings, new DraftsUI(settings)).sync();
}

syncKuttLinks();
