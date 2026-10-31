require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/GmailSender.js");

// Creates a Gmail draft from the current draft. Fails the action on error so
// later steps (like trashing the draft) do not run.
function sendToGmail() {
  const settings = loadSettings("nr-settings.json");
  new GmailSender(settings.gmail, new DraftsUI()).send(draft.content);
}

sendToGmail();
