require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/FastmailSender.js");

// Creates a Fastmail draft from the current draft. Fails the action on error
// so later steps (like trashing the draft) do not run.
function sendToFastmail() {
  const settings = loadSettings("nr-settings.json");
  new FastmailSender(settings.fastmail, new DraftsUI()).send(draft.content);
}

sendToFastmail();
