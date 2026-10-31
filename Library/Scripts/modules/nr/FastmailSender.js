if (typeof EmailSender == "undefined") require("modules/nr/EmailSender.js");
if (typeof Fastmail == "undefined") require("shared/libraries/fastmail.js");

// Creates a Fastmail draft from a draft written as an email (see EmailSender).
// Prompt wording lives under `fastmail` in nr-settings.yaml.
class FastmailSender extends EmailSender {
  get serviceName() {
    return "Fastmail";
  }

  createClient() {
    return new Fastmail();
  }
}
