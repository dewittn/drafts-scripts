// Fastmail JMAP Client by Nelson/Roberto (@dewittn)
// Creates email drafts in Fastmail through the JMAP API.
// Based on https://github.com/fastmail/JMAP-Samples/blob/main/javascript/hello-world.js

// ***************
// * Fastmail Class
// ***************
class Fastmail {
  static hostname = "api.fastmail.com";
  // Mail only: creating a draft doesn't need the submission (send) scope,
  // so the API token can be limited to mail access.
  static capabilities = ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"];

  #username;
  #token;
  #session;

  constructor() {
    this.#authorize();
  }

  get isAuthorized() {
    return Boolean(this.#username && this.#token);
  }

  // Setup & Store Credentials
  #authorize() {
    let credential = Credential.create("Fastmail", "Fastmail JMAP API token (Settings → Privacy & Security → API tokens)");
    credential.addTextField("username", "Fastmail email address");
    credential.addPasswordField("token", "API Token");
    credential.authorize();
    this.#username = credential.getValue("username");
    this.#token = credential.getValue("token");
  }

  // Creates a draft in the Drafts mailbox. Nothing is sent.
  // `to` is a list of { name, email } objects and may be empty.
  createDraft({ to = [], subject = "", text = "", html }) {
    if (!this.isAuthorized) return this.#error("Missing Fastmail credentials");

    const session = this.#getSession();
    if (session.error) return session;

    const mailbox = this.#draftsMailboxId(session);
    if (mailbox.error) return mailbox;

    const email = this.#buildEmail(mailbox.id, { to, subject, text, html });
    const result = this.#call([["Email/set", { accountId: session.accountId, create: { draft: email } }, "email"]]);
    if (result.error) return result;

    const notCreated = result.email.notCreated?.draft;
    if (notCreated) return this.#error(`Draft not created: ${notCreated.description ?? notCreated.type}`);

    return { success: true, email: result.email.created.draft };
  }

  // The Drafts mailbox as { id }, or an error result when it can't be found.
  #draftsMailboxId(session) {
    const lookup = this.#call([
      ["Mailbox/query", { accountId: session.accountId, filter: { role: "drafts" } }, "mailbox"],
    ]);
    if (lookup.error) return lookup;

    const id = lookup.mailbox.ids?.[0];
    if (id == undefined) return this.#error("Drafts mailbox not found");
    return { id };
  }

  // A JMAP Email object filed in the Drafts mailbox, with an HTML part when given.
  #buildEmail(mailboxId, { to, subject, text, html }) {
    // Fastmail matches the From address to your identity when the draft is opened.
    const from = [{ email: this.#username }];

    const bodyValues = { text: { value: text } };
    const email = {
      mailboxIds: { [mailboxId]: true },
      keywords: { $draft: true, $seen: true },
      from,
      to,
      subject,
      bodyValues,
      textBody: [{ partId: "text", type: "text/plain" }],
    };
    if (html != undefined) {
      bodyValues.html = { value: html };
      email.htmlBody = [{ partId: "html", type: "text/html" }];
    }
    return email;
  }

  // Fetches the JMAP session once per instance for the API URL and mail account.
  #getSession() {
    if (this.#session) return this.#session;

    const response = HTTP.create().request({
      url: `https://${this.constructor.hostname}/jmap/session`,
      method: "GET",
      headers: { Authorization: `Bearer ${this.#token}` },
    });
    if (!response.success) return this.#requestError(response, "Session Request Failed");

    const session = JSON.parse(response.responseText);
    this.#session = {
      apiUrl: session.apiUrl,
      accountId: session.primaryAccounts["urn:ietf:params:jmap:mail"],
    };
    return this.#session;
  }

  // Sends method calls in one request and returns the responses keyed by call id.
  #call(methodCalls) {
    const response = HTTP.create().request({
      url: this.#session.apiUrl,
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.#token}`,
        "Content-Type": "application/json",
      },
      encoding: "json",
      data: { using: this.constructor.capabilities, methodCalls },
    });
    if (!response.success) return this.#requestError(response, "API Request Failed");

    const results = {};
    for (const [name, args, callId] of JSON.parse(response.responseText).methodResponses) {
      if (name == "error") return this.#error(`JMAP ${args.type}: ${args.description ?? callId}`);
      results[callId] = args;
    }
    return results;
  }

  // Error handling
  #requestError(response, message) {
    console.log(`${message}\n${response.responseText}`);
    return this.#error(`${response.statusCode} - ${message}`);
  }

  #error(message) {
    const errorMessage = `Fastmail Error: ${message}`;
    console.log(errorMessage);
    return { success: false, error: errorMessage };
  }
}
