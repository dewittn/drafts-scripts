require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/ShortLinks.js");

// Picks a saved Kutt short link and edits its page URL, address or description.
function editShortLink() {
  const settings = loadSettings("nr-settings.json").kutt;
  new ShortLinks(settings, new DraftsUI()).editPrompted();
}

editShortLink();
