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

  // Offers to open Gmail once the draft exists, to review and send it.
  // yesNoPrompt adds its buttons to the settings it is given, so it gets a copy.
  send(content) {
    const result = super.send(content);
    if (result && this.ui.yesNoPrompt({ ...this.settings.openPrompt }) == "yes") app.openURL(this.#gmailURL);
    return result;
  }

  // The Gmail app on iPhone and iPad, and the web Drafts folder on a Mac.
  get #gmailURL() {
    const { draftsURL, draftsAppURL } = this.settings;
    return device.systemName == "iOS" ? draftsAppURL : draftsURL;
  }
}
