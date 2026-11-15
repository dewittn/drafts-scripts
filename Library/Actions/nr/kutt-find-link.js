require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/ShortLinks.js");

// Picks a saved Kutt short link from a searchable list and inserts it.
function findShortLink() {
  const settings = loadSettings("nr-settings.json").kutt;
  new ShortLinks(settings, new DraftsUI()).findPrompted();
}

findShortLink();
