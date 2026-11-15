require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/ShortLinks.js");

// Asks for a link and inserts its Kutt short link at the cursor.
function shortenLink() {
  const settings = loadSettings("nr-settings.json").kutt;
  new ShortLinks(settings, new DraftsUI(settings)).shortenPrompted();
}

shortenLink();
