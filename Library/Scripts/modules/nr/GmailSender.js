if (typeof EmailSender == "undefined") require("modules/nr/EmailSender.js");
if (typeof Gmail == "undefined") require("shared/libraries/gmail.js");

// Creates a Gmail draft from a draft written as an email (see EmailSender).
// Prompt wording lives under `gmail` in nr-settings.yaml.
class GmailSender extends EmailSender {
  get serviceName() {
    return "Gmail";
  }

  createClient() {
    return new Gmail();
  }

  // Opens Gmail's Drafts folder once the draft exists, to review and send it.
  send(content) {
    const result = super.send(content);
    if (result) app.openURL(this.settings.draftsURL);
    return result;
  }
}
