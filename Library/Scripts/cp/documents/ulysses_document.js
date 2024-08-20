require("libraries/ulysses-v2.js");

class UlyssesDoc {
  static docIDType = "UlyssesID";
  #ui;
  #text;
  #ulysses;
  #settings;
  #statuses;
  #defaultTag;
  #destinations;

  #data = {};
  #content;
  #stackTrace;
  #inPipeline;
  #currentDest;
  #currentStatus;
  #currentTitle;

  constructor(dependancies, record = {}) {
    this.#ui = dependancies.ui;
    this.#text = dependancies.textUltilities;
    this.#settings = dependancies.settings;
    this.#statuses = dependancies.statuses;
    this.#destinations = dependancies.destinations;
    this.#defaultTag = dependancies.defaultTag;
    this.#ulysses = new Ulysses();

    this.#data.record = record;
    this.#data.docID = this.#getIdOfSheet();
  }

  get stackTrace() {
    return this.#stackTrace;
  }

  get id() {
    return this.#data.docID;
  }

  get docID() {
    return this.#data.docID;
  }

  get docIDType() {
    return this.constructor.docIDType;
  }

  get record() {
    return this.#data.record;
  }

  set record(record) {
    if (record?.docID == undefined)
      return this.#ui.displayErrorMessage({
        errorMessage: "Record does not have an id!",
        class: "UlyssesDoc",
        function: "set record()",
        record: record,
      });

    if (record.docID != this.docID) {
      record.docID = this.docID;
      record.docIDType = this.docIDType;
    }

    this.#data.record = record;
  }

  get recordID() {
    return this.record.id;
  }

  get title() {
    if (this.#currentTitle == undefined)
      this.#currentTitle = this.#getTitleOfSheet();

    return this.#currentTitle;
  }

  get Title() {
    return this.title;
  }

  get scrubedTitle() {
    if (this.#data?.scrubedTitle == undefined) {
      this.#data.scrubedTitle = this.#text.scrubTitle(
        this.title,
        this.#destinations.getScrubText(this.destination)
      );
    }

    return this.#data.scrubedTitle;
  }

  get slug() {
    if (this.#data.slug == undefined)
      this.#data.slug = this.#text.convertTitleToSlug(this.scrubedTitle);

    return this.#data.slug;
  }

  get UlyssesID() {
    return this.#data.docID;
  }

  get content() {
    return this.#data.content;
  }

  set content(newContent) {
    this.#data.content = this.#text.convertMarkdown(newContent);
  }

  get status() {
    if (this.#currentStatus == undefined)
      this.#currentStatus = this.#getStatusOfSheet();

    return this.#currentStatus;
  }

  set status(newStatus) {
    if (newStatus == undefined) return;
    if (this.#currentStatus == undefined)
      this.#currentStatus = this.#getStatusOfSheet();
    if (this.#currentStatus == newStatus) return;

    if (this.docID != undefined)
      this.#updateKeywords(this.#currentStatus, newStatus);
    this.#currentStatus = newStatus;
  }

  get statusIsNotSet() {
    return this.status == "";
  }

  get destination() {
    if (this.#currentDest == undefined)
      this.#currentDest = this.#getDestinationOfSheet();

    return this.#currentDest;
  }

  set destination(newDest) {
    // Check if newDest exists in Destinations
    if (this.#destinations.isValidKey(newDest) == false) return;
    if (this.#currentDest == undefined) this.#getDestinationOfSheet();
    if (this.#currentDest == newDest) return;

    if (this.docID != undefined)
      this.#updateKeywords(this.#currentDest, newDest);
    this.#currentDest = newDest;
  }

  get destinationIsNotSet() {
    return this.#currentDest == "";
  }

  get airtableDestination() {
    return this.#destinations.lookupAirTableDestinationName(this.destination);
  }

  get inPipeline() {
    if (this.#inPipeline == undefined)
      this.#inPipeline = this.#sheetIsInPipeline();

    return this.#inPipeline;
  }

  set inPipeline(value) {
    if (typeof value !== "boolean") return;

    if (value) this.#ulysses.attachKeywords(this.docID, this.#defaultTag);
    this.#inPipeline = value;
  }

  static load(dests, record) {
    return new UlyssesDoc(dests, record);
  }

  open() {
    return this.#ulysses.open(this.docID);
  }

  save() {
    if (this.docID != undefined) return false;
    const groupID = this.#destinations.lookupGroupID(this.#currentDest);

    // Ulysses should return a sheet that has the new target ID
    this.sheet = this.#ulysses.newSheet(this.content, groupID);
    if (this.sheet?.errorCode == 1) {
      this.#stackTrace = {
        class: "UlyssesDoc",
        function: "save()",
        sheet: this.sheet,
        content: this.content,
        groupID: groupID,
      };
      return false;
    }

    this.#data.docID = this.sheet.identifier;

    this.#ulysses.attachKeywords(
      this.docID,
      `${this.#defaultTag}, ${this.destination}, ${this.status}`
    );
    this.attachDefaultNotes();
    return true;
  }

  delete() {
    this.#ulysses.trash(this.docID);
  }

  attachDefaultNotes() {
    const {
      excerptText,
      darftsCallbackData: cbData,
      piplineLinks,
    } = this.#settings;
    if (this.docID == undefined) return;

    this.sheet.notes.forEach((note) => {
      this.#ulysses.removeNote(this.docID, 0);
      this.#sleep(1);
    });

    // Attach excerpt text
    if (excerptText != undefined)
      this.#ulysses.attachNote(this.docID, excerptText);

    // Attach Pipeline links formatted in markdown
    if (piplineLinks != undefined) {
      const markdownNote = piplineLinks
        .map(
          (link) =>
            `[${link.linkText}](${cbData.baseURL}${cbData.runActionParams}${link.actionName}${cbData.uuidParams}${this.docID})`
        )
        .join("\n");
      this.#ulysses.attachNote(this.docID, markdownNote);
    }

    this.sheet?.notes.forEach((note) => {
      this.#ulysses.attachNote(this.docID, note);
      this.#sleep(1);
    });
  }

  // **************
  // * Private Functions
  // **************
  #loadSheet() {
    if (this.sheet == undefined)
      this.sheet = this.#ulysses.readSheet(this.docID);
    editor.activate();
  }

  #getIdOfSheet() {
    return this.#data.record.docID;
  }

  #getTitleOfSheet() {
    if (this.record?.Title != undefined) return this.record.Title;

    this.#loadSheet();

    return this.sheet?.title;
  }

  #getDestinationOfSheet() {
    if (this.record?.Destination != undefined) return this.record.Destination;
    if (this.docID == undefined) return "";

    this.#loadSheet();
    const checkDestFunction = (testSheet) => (dest) => {
      return testSheet.hasKeyword(dest);
    };

    const hasDest = checkDestFunction(this.sheet);

    return this.#destinations.getCurrentDestination(hasDest);
  }

  #getStatusOfSheet() {
    if (this.record?.Status != undefined) return this.record.Status;
    if (this.docID == undefined) return "";

    this.#loadSheet();
    const checkStatusFunction = (testSheet) => (status) => {
      return testSheet.hasKeyword(status);
    };
    const hasStatus = checkStatusFunction(this.sheet);

    return this.#statuses.getCurrentStatus(hasStatus);
  }

  #updateKeywords(keywordToRemove, keywordToAdd) {
    this.#ulysses.removeKeywords(this.docID, keywordToRemove);
    this.#sleep(1);
    this.#ulysses.attachKeywords(this.docID, keywordToAdd);
  }

  #sleep(seconds) {
    const delay = seconds * 1000;
    let dtCurrent = new Date().getTime();
    const dtEnd = dtCurrent + delay;
    while (dtCurrent < dtEnd) {
      dtCurrent = new Date().getTime();
    }
  }

  #sheetIsInPipeline() {
    this.#loadSheet();

    return this.sheet.keywords.includes(this.#defaultTag);
  }
}
