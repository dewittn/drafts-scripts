require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/NewEmail.js");

const settings = loadSettings("nr-settings.json");
new NewEmail(settings.newEmail, new DraftsUI()).create();
