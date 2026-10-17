// Splits a draft written as an email into subject, recipients, and body.
//
// Expected shape (field lines are case-insensitive and optional):
//
//   # Email to Jane            <- dropped when the first line is a heading
//   To: Jane Smith             <- recipient name
//   Email: jane@example.com    <- recipient address(es), comma separated
//   Subject: Lunch on Friday
//
//   Body text in Markdown...
//
// Only field lines at the top of the draft are read and removed, so an
// "Email:" line in a signature stays in the body.
class EmailDraft {
  static fieldPattern = /^\s*(subject|email|to)\s*:\s*(.*?)\s*$/i;
  static addressPattern = /^\s*(?:"?([^"<]*?)"?\s*<\s*)?([^\s<>@,;]+@[^\s<>,;]+?)\s*>?\s*$/;
  static validEmailPattern = /^[^\s@<>()\[\],;:"]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
  static markdownLinkPattern = /\[[^\]]*\]\(\s*(?:mailto:)?([^)\s]*)\s*\)/gi;

  #subject;
  #to;
  #recipients;
  #body;
  #invalidAddresses;

  constructor(content = "") {
    const lines = content.split("\n");
    let index = 0;

    while (index < lines.length && lines[index].trim() == "") index++;
    if (/^\s*#/.test(lines[index] ?? "")) index++;

    const fields = {};
    for (; index < lines.length; index++) {
      if (lines[index].trim() == "") continue;

      const match = this.constructor.fieldPattern.exec(lines[index]);
      if (match == null) break;

      const key = match[1].toLowerCase();
      fields[key] ??= match[2];
    }

    this.#subject = fields.subject ?? "";
    this.#to = fields.to ?? "";
    this.#recipients = this.constructor.parseRecipients(fields.to, fields.email);
    this.#invalidAddresses = EmailDraft.findInvalidAddresses(fields.to, fields.email);
    this.#body = lines.slice(index).join("\n").trim();
  }

  // Turns "Jane Smith <jane@x.com>" or "jane@x.com" into { name, email }.
  // Markdown links and mailto: prefixes are unwrapped first. Returns undefined
  // when the text holds no valid address.
  static parseAddress(text = "") {
    const cleaned = text.replace(this.markdownLinkPattern, "$1").replace(/mailto:/gi, "");
    const match = this.addressPattern.exec(cleaned);
    if (match == null || !this.validEmailPattern.test(match[2])) return undefined;
    return { name: match[1]?.trim() || null, email: match[2] };
  }

  // Parts of the To and Email lines that look like addresses (contain "@")
  // but fail validation, such as "jane@example." Returned as written.
  static findInvalidAddresses(to = "", email = "") {
    return [to, email]
      .flatMap((text) => text.split(/[,;]/))
      .map((part) => part.trim())
      .filter((part) => part.includes("@") && this.parseAddress(part) == undefined);
  }

  // "Email:" holds the address(es) and "To:" the name. A lone address takes the
  // To name. When there is no Email line, To may hold the address itself.
  static parseRecipients(to = "", email = "") {
    const parseList = (text) =>
      text
        .split(/[,;]/)
        .map((part) => this.parseAddress(part))
        .filter(Boolean);

    const recipients = parseList(email);
    if (recipients.length == 0) return parseList(to);

    if (recipients.length == 1 && recipients[0].name == null && to != "" && !to.includes("@")) {
      recipients[0].name = to;
    }
    return recipients;
  }

  get subject() {
    return this.#subject;
  }

  set subject(subject) {
    this.#subject = subject;
  }

  // Raw "To:" line, kept so a prompt can offer the name when no address parsed.
  get to() {
    return this.#to;
  }

  get invalidAddresses() {
    return this.#invalidAddresses;
  }

  get recipients() {
    return this.#recipients;
  }

  set recipients(recipients) {
    this.#recipients = recipients;
  }

  // Appends a Markdown signature so it lands in both the text and HTML parts.
  addSignature(signature = "") {
    if (signature.trim() == "") return;
    this.#body = `${this.#body}\n\n${signature.trim()}`;
  }

  // Markdown source, used for the HTML conversion.
  get body() {
    return this.#body;
  }

  // Plain-text part: the Markdown source with backslash escapes removed, so
  // "\-\-\-" reads as "---".
  get text() {
    return this.#body.replace(/\\([!-\/:-@\[-`{-~])/g, "$1");
  }

  // Single newlines become <br> so signatures and addresses keep their lines.
  get html() {
    const markdown = GitHubMarkdown.create();
    markdown.hardBreaks = true;
    return markdown.render(this.#body);
  }
}
