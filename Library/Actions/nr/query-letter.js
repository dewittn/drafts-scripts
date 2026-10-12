require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/QueryLetter.js");

const settings = loadSettings("nr-settings.json");
const queryLetter = new QueryLetter(settings.queryLetter, new DraftsUI());
queryLetter.create();
