class EmailMessage {
  #bodyText;

  constructor(msgConfig) {
    this.msgConfig = msgConfig;
    this.messageText;
    this.subjectLine;
  }

  get attendaceDraft() {
    return this.msgConfig.attendaceDraft;
  }

  get subjectLineTemplate() {
    return this.msgConfig.subjectLine;
  }

  get bodyText() {
    return this.msgConfig.bodyText;
  }

  get toRecipients() {
    return this.msgConfig.recipients;
  }

  get ccRecipients() {
    return this.msgConfig?.ccRecipients;
  }

  get successMsg() {
    return this.msgConfig.successMsg;
  }

  get failureMsg() {
    return this.msgConfig.failureMsg;
  }

  get templateTags() {
    if (this.msgConfig.templateTags == undefined) return [];
    return Object.entries(this.msgConfig.templateTags);
  }

  get templateTag() {
    return this.msgConfig.msgTemplateTag;
  }

  get teamName() {
    return this.msgConfig.teamName;
  }

  compose(names) {
    const { bodyText, subjectLine } = this.#processTemplateText();
    this.messageText = `${bodyText}${this.#flattenNames(names)}`;
    this.subjectLine = subjectLine;
  }

  send() {
    const mail = Mail.create();
    mail.toRecipients = this.toRecipients;
    if (this.ccRecipients != undefined) mail.ccRecipients = this.ccRecipients;
    mail.subject = this.subjectLine;
    mail.body = this.messageText;

    return mail.send();
  }

  #flattenNames(names) {
    if (names == undefined) return "";
    return names.map((name) => `- ${name}\n`).join("");
  }

  #processTemplateText() {
    const tempDraft = Draft.create();
    this.templateTags.forEach(([key, value]) => tempDraft.setTemplateTag(key, value));
    return {
      bodyText: tempDraft.processTemplate(this.bodyText),
      subjectLine: tempDraft.processTemplate(this.subjectLineTemplate),
    };
  }
}
