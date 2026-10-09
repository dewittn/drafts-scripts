require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/QueryLetter.js");

const settings = loadSettings("nr-settings.yaml");
const queryLetter = new QueryLetter(settings.queryLetter, new DraftsUI());
queryLetter.create();
