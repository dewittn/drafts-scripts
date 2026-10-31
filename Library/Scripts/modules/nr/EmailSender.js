if (typeof EmailDraft == "undefined") require("modules/nr/EmailDraft.js");

// Creates a draft in a mail service from a draft written as an email (see
// EmailDraft). Each service is a small subclass, such as FastmailSender, that
// names the service and supplies a client with createDraft().
//
// Asks whether to attach the signature, prompts for a missing subject or
// recipient, and fails the action on error so later steps (like trashing the
// draft) do not run. Prompt wording lives under the service's key in
// nr-settings.yaml.
class EmailSender {
  // Which prompt fields each missing part of the email needs.
  static promptFields = { subject: ["subject"], recipient: ["to", "email"] };

  #settings;
  #ui;

  constructor(settings, ui) {
    this.#settings = settings;
    this.#ui = ui;
  }

  get settings() {
    return this.#settings;
  }

  get ui() {
    return this.#ui;
  }

  // The name in messages. Subclasses supply it.
  get serviceName() {
    return "Email";
  }

  /**
   * The service's client. Subclasses supply it.
   * @returns {any}
   */
  createClient() {
    throw new Error("EmailSender subclasses must supply createClient()");
  }

  send(content) {
    const email = new EmailDraft(content);
    if (email.invalidAddresses.length > 0) {
      return this.#fail(`Invalid email address: ${email.invalidAddresses.join(", ")}`);
    }

    if (this.#wantsSignature()) email.addSignature(this.settings.signature);
    if (this.#promptForMissingFields(email) == false) return this.#cancel("Missing email fields");

    const result = this.createClient().createDraft({
      to: email.recipients,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    if (!result.success) return this.#fail(result.error);

    this.#ui.displayAppMessage("success", this.#successMessage(email.recipients));
    return result;
  }

  // Asks only when a signature is set. yesNoPrompt adds its buttons to the
  // settings it is given, so it gets a copy.
  #wantsSignature() {
    const { signature, signaturePrompt } = this.settings;
    if (!signature) return false;
    return this.#ui.yesNoPrompt({ ...signaturePrompt }) == "yes";
  }

  // Asks for whichever of the subject and recipient the draft is missing, and
  // again when a typed address does not parse. Returns false on cancel.
  #promptForMissingFields(email, error = "") {
    const missing = { subject: email.subject == "", recipient: email.recipients.length == 0 };
    if (!missing.subject && !missing.recipient) return true;

    const prompt = this.#ui.buildMenu(this.#missingFieldsMenu(email, missing, error));
    if (prompt.show() == false) return false;

    const { subject = "", to = "", email: address = "" } = prompt.fieldValues;
    if (missing.subject) email.subject = subject.trim();
    if (!missing.recipient) return true;

    email.recipients = EmailDraft.parseRecipients(to.trim(), address.trim());
    if (address.trim() == "" || email.recipients.length > 0) return true;
    return this.#promptForMissingFields(email, this.#invalidAddressMessage(address.trim()));
  }

  // The configured menu cut down to the missing fields, with the draft's To
  // name filled in. Copies items so the settings are not changed.
  #missingFieldsMenu(email, missing, error) {
    const { menuSettings } = this.settings.missingFields;
    const shown = Object.keys(missing)
      .filter((part) => missing[part])
      .flatMap((part) => EmailSender.promptFields[part]);

    const menuItems = menuSettings.menuItems
      .filter((item) => item.type == "button" || shown.includes(item.data.name))
      .map((item) => (item.data.name == "to" ? { ...item, data: { ...item.data, initialText: email.to } } : item));

    return { ...menuSettings, menuMessage: error || this.#missingMessage(missing), menuItems };
  }

  #missingMessage(missing) {
    const { messages } = this.settings.missingFields;
    if (missing.subject && missing.recipient) return messages.both;
    return missing.subject ? messages.subject : messages.recipient;
  }

  #invalidAddressMessage(address) {
    return this.settings.missingFields.invalidAddress.replace("[[address]]", () => address);
  }

  #successMessage(recipients) {
    const names = recipients.map((item) => item.name ?? item.email).join(", ");
    return `${this.serviceName} draft created${names ? ` for ${names}` : ""}`;
  }

  // context.fail shows the message itself and stops the action's later steps.
  #fail(message) {
    context.fail(message);
    return false;
  }

  #cancel(message) {
    context.cancel(message);
    return false;
  }
}
