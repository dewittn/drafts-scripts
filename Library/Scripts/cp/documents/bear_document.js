require("libraries/bear.js");

class BearDoc {
  static docIDType = "BearID";
  #dependencyProvider;
  #ui;
  #text;
  #bear;
  #settings;

  #data = {};
  #content;
  #stackTrace;
  #inPipeline;
  #currentDest;
  #currentStatus;
  #currentTitle;

  constructor(dependencyProvider, settings, record = {}) {
    this.#dependencyProvider = dependencyProvider;
    this.#ui = dependencyProvider.ui;
    this.#text = dependencyProvider.textUltilities;
    this.#settings = settings;
    this.#bear = new Bear();

    this.#data.record = record;
    this.#data.docID = this.#getIdOfNote();
  }

  // Lazy getters for dependencies
  get #statuses() {
    return this.#dependencyProvider.statuses;
  }

  get #destinations() {
    return this.#dependencyProvider.destinations;
  }

  get #defaultTag() {
    return this.#dependencyProvider.defaultTag;
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
    const errorMessage = "Record does not have an id!";
    if (record?.docID == undefined) {
      return this.#ui.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "BearDoc",
        function: "set record()",
        record: record,
      });
    }

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
    if (this.#currentTitle == undefined) {
      this.#currentTitle = this.#getTitleOfNote();
    }

    return this.#currentTitle;
  }

  get Title() {
    return this.title;
  }

  get scrubedTitle() {
    if (this.#data?.scrubedTitle == undefined) {
      this.#data.scrubedTitle = this.#text.scrubTitle(
        this.title,
        this.#destinations.getScrubText(this.destination),
      );
    }

    return this.#data.scrubedTitle;
  }

  get slug() {
    if (this.#data.slug == undefined) {
      this.#data.slug = this.#text.convertTitleToSlug(this.scrubedTitle);
    }

    return this.#data.slug;
  }

  get BearID() {
    return this.#data.docID;
  }

  get content() {
    return this.#data.content;
  }

  set content(newContent) {
    this.#data.content = this.#text.convertMarkdown(newContent);
  }

  get status() {
    if (this.#currentStatus == undefined) {
      this.#currentStatus = this.#getStatusOfNote();
    }

    return this.#currentStatus;
  }

  set status(newStatus) {
    if (newStatus == undefined) return;
    if (this.#currentStatus == undefined) {
      this.#currentStatus = this.#getStatusOfNote();
    }
    if (this.#currentStatus == newStatus) return;

    if (this.docID != undefined) {
      this.#updateTags(this.#currentStatus, newStatus);
    }
    this.#currentStatus = newStatus;
  }

  get statusIsNotSet() {
    return this.status == "";
  }

  get destination() {
    if (this.#currentDest == undefined) {
      this.#currentDest = this.#getDestinationOfNote();
    }

    return this.#currentDest;
  }

  set destination(newDest) {
    // Check if newDest exists in Destinations
    if (this.#destinations.isValidKey(newDest) == false) return;
    if (this.#currentDest == undefined) this.#getDestinationOfNote();
    if (this.#currentDest == newDest) return;

    if (this.docID != undefined) {
      this.#updateTags(this.#currentDest, newDest);
    }
    this.#currentDest = newDest;
  }

  get destinationIsNotSet() {
    return this.#currentDest == "";
  }

  get airtableDestination() {
    return this.#destinations.lookupAirTableDestinationName(this.destination);
  }

  get inPipeline() {
    if (this.#inPipeline == undefined) {
      this.#inPipeline = this.#noteIsInPipeline();
    }

    return this.#inPipeline;
  }

  set inPipeline(value) {
    if (typeof value !== "boolean") return;

    if (value && this.docID != undefined) {
      // Add pipeline tag to note
      const currentText = this.note?.text || "";
      const pipelineTag = `#${this.#defaultTag}`;
      if (!currentText.includes(pipelineTag)) {
        this.#bear.addText(this.docID, null, `\n${pipelineTag}`, "append", "no");
      }
    }
    this.#inPipeline = value;
  }

  open() {
    return this.#bear.open(this.docID);
  }

  save() {
    if (this.docID != undefined) return false;

    // Create new note in Bear
    const tags = this.#buildTags();
    this.note = this.#bear.create(this.title, this.content, tags);

    if (this.#bear.error) {
      this.#stackTrace = {
        class: "BearDoc",
        function: "save()",
        note: this.note,
        content: this.content,
        tags: tags,
        error: this.#bear.errorMessage,
      };
      return false;
    }

    this.#data.docID = this.note.identifier;
    return true;
  }

  delete() {
    this.#bear.trash(this.docID);
  }

  // **************
  // * Private Functions
  // **************
  #loadNote() {
    if (this.note == undefined) {
      this.note = this.#bear.grabUrl(this.docID);
    }

    if (this.#bear.error) {
      this.#ui.displayAppMessage(
        "error",
        `Bear Error - ${this.#bear.errorMessage} : Note not loaded!`,
      );
    }
  }

  #getIdOfNote() {
    return this.#data.record.docID;
  }

  #getTitleOfNote() {
    if (this.record?.Title != undefined) return this.record.Title;

    this.#loadNote();

    return this.note?.title;
  }

  #getDestinationOfNote() {
    if (this.record?.Destination != undefined) return this.record.Destination;
    if (this.docID == undefined) return "";

    this.#loadNote();
    if (this.note == undefined) return "";

    const checkDestFunction = (testNote) => (dest) => {
      return testNote.hasTag(dest);
    };

    const hasDest = checkDestFunction(this.note);

    return this.#destinations.getCurrentDestination(hasDest);
  }

  #getStatusOfNote() {
    if (this.record?.Status != undefined) return this.record.Status;
    if (this.docID == undefined) return "";

    this.#loadNote();
    if (this.note == undefined) return "";

    const checkStatusFunction = (testNote) => (status) => {
      return testNote.hasTag(status);
    };
    const hasStatus = checkStatusFunction(this.note);

    return this.#statuses.getCurrentStatus(hasStatus);
  }

  #updateTags(tagToRemove, tagToAdd) {
    // Bear doesn't have direct tag removal API, so we need to:
    // 1. Get the current note content
    // 2. Remove the old tag from content
    // 3. Add the new tag
    if (this.docID == undefined) return;

    this.#loadNote();
    if (this.note == undefined) return;

    // Add new tag using Bear's API
    const newTag = tagToAdd.startsWith('#') ? tagToAdd : `#${tagToAdd}`;
    this.#bear.addText(this.docID, null, `\n${newTag}`, "append", "no");
  }

  #buildTags() {
    // Build comma-separated tags string for Bear
    const tags = [];

    if (this.#defaultTag) tags.push(this.#defaultTag);
    if (this.destination) tags.push(this.destination);
    if (this.status) tags.push(this.status);

    return tags.join(", ");
  }

  #noteIsInPipeline() {
    if (this.docID == undefined) return false;

    this.#loadNote();
    if (this.note == undefined) return false;

    return this.note.hasTag(this.#defaultTag);
  }
}