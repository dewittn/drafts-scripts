class TextMessage {
  #msgConfig;

  constructor(msgConfig) {
    this.#msgConfig = msgConfig;
    this.messageText;
  }

  get successMsg() {
    return this.#msgConfig.successMsg;
  }

  get failureMsg() {
    return this.#msgConfig.failureMsg;
  }

  get bodyText() {
    return this.#msgConfig.bodyText;
  }

  get recipients() {
    return this.#msgConfig.recipients;
  }

  get templateTags() {
    if (this.#msgConfig.templateTags == undefined) return [];
    return Object.entries(this.#msgConfig.templateTags);
  }

  compose(names) {
    this.messageText = `${this.#processBodyText()}${this.#processNames(names)}`;
  }

  send() {
    const message = Message.create();
    message.toRecipients = this.recipients;
    message.body = this.messageText;
    return message.send();
  }

  #processNames(names) {
    if (names == undefined) return "";

    switch (names.length) {
      case 0:
        return "";
      case 1:
        return ` ${names[0]}`;
        break;
      case 2:
        return ` ${names.join(" and ")}`;
        break;
      default:
        const lastPerson = names.splice(-1);
        return ` ${names.join(", ")} and ${lastPerson}`;
    }
  }

  #processBodyText() {
    const tempDraft = Draft.create();
    this.templateTags.forEach(([key, value]) =>
      tempDraft.setTemplateTag(key, value)
    );
    return tempDraft.processTemplate(this.bodyText);
  }
}
