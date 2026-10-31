// Gmail Drafts Client by Nelson/Roberto (@dewittn)
// Creates email drafts in Gmail through a Google Apps Script web app, the one in
// scripts/gmail-drafts/Code.gs. Its header explains why, and how to deploy it.

// ***************
// * Gmail Class
// ***************
class Gmail {
  #url;
  #secret;

  // Formats { name, email } the way an email header expects. The name is quoted,
  // since a comma in it would otherwise split the recipient list.
  static formatRecipient({ name, email }) {
    if (!name) return email;
    const quoted = name.replace(/(["\\])/g, "\\$1");
    return `"${quoted}" <${email}>`;
  }

  constructor() {
    this.#authorize();
  }

  get isAuthorized() {
    return Boolean(this.#url && this.#secret);
  }

  // Setup & Store Credentials
  #authorize() {
    const credential = Credential.create("Gmail Drafts", "The Apps Script web app that creates Gmail drafts");
    credential.addTextField("url", "Web app URL");
    credential.addPasswordField("secret", "Secret key");
    credential.authorize();
    this.#url = credential.getValue("url");
    this.#secret = credential.getValue("secret");
  }

  // Creates a draft in Gmail. Nothing is sent.
  // `to` is a list of { name, email } objects and may be empty.
  createDraft({ to = [], subject = "", text = "", html }) {
    if (!this.isAuthorized) return this.#error("Missing Gmail credentials");

    const response = HTTP.create().request({
      url: this.#url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      encoding: "json",
      data: {
        secret: this.#secret,
        to: to.map((recipient) => Gmail.formatRecipient(recipient)).join(", "),
        subject,
        text,
        html,
      },
    });
    if (!response.success) return this.#requestError(response);

    const result = this.#parseResult(response);
    if (result == undefined) return this.#requestError(response);
    if (result.error) return this.#error(result.error);
    return { success: true, id: result.id };
  }

  // The web app replies in JSON, but Google answers with an HTML page when the
  // deployment is wrong or the script crashes.
  #parseResult(response) {
    try {
      return JSON.parse(response.responseText);
    } catch {
      return undefined;
    }
  }

  // Error handling
  #requestError(response) {
    console.log(`Gmail Request Failed\n${response.responseText}`);
    return this.#error(`${response.statusCode} - The web app did not create a draft`);
  }

  #error(message) {
    const errorMessage = `Gmail Error: ${message}`;
    console.log(errorMessage);
    return { success: false, error: errorMessage };
  }
}
