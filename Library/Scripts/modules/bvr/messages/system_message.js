class SystemMessage {
  constructor(messageDetails) {
    this.messageDetails = messageDetails;
    this.messageText;
  }

  get successMsg() {
    return this.messageDetails.successMsg;
  }

  get failureMsg() {
    return this.messageDetails.failureMsg;
  }

  get subjectLine() {
    return this.attendaceDraft.processTemplate(this.messageDetails.subjectLine);
  }

  compose(names) {
    switch (names.length) {
      case 1:
        this.messageText = `${this.messageDetails.bodyText} ${names[0]}`;
        break;
      case 2:
        this.messageText = `${this.messageDetails.bodyText} ${names.join(" and ")}`;
        break;
      default:
        const lastPerson = names.splice(-1);
        this.messageText = `${this.messageDetails.bodyText} ${names.join(", ")} and ${lastPerson}`;
    }
  }

  send() {
    const prompt = Prompt.create();
    prompt.title = "Message Preview";
    prompt.message = this.messageText;
    prompt.addButton("OK");
    prompt.isCancellable = false;
    return prompt.show();
  }
}
