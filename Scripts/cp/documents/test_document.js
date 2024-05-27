class TestDoc {
  static docIDType = "TestID";
  #title;
  #docID;

  constructor(doc) {
    this.#docID = doc.docID;
    this.#title = doc.title;
  }

  get docID() {
    return this.#docID;
  }

  get docIDType() {
    return this.constructor.docIDType;
  }

  get status() {
    return "draft";
  }

  set status(newStatus) {
    return newStatus;
  }

  get title() {
    return this.#title;
  }

  get Title() {
    return this.#title;
  }

  get destination() {
    return "nr.com";
  }

  set destination(newDest) {
    return newDest;
  }

  open() {
    return true;
  }
}
