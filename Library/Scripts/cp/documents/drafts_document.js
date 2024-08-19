class DraftsDoc {
  static docIDType = "DraftsID";
  #ui;
  #text;
  #settings;
  #statuses;
  #destinations;
  #template_factory;

  #data = {};
  #defaultTag;
  #docID;
  #record;
  #currentDest;
  #currentStatus;
  #currentTitle;
  #inPipeline;

  constructor(dependancies, record = {}) {
    this.#ui = dependancies.ui;
    this.#settings = dependancies.settings;
    this.#defaultTag = dependancies.defaultTag;
    this.#statuses = dependancies.statuses;
    this.#destinations = dependancies.destinations;
    this.#text = dependancies.textUltilities;
    this.#template_factory = new TemplateFactory(dependancies);

    this.#record = record;
    this.workingDraft = this.#findOrCreateWorkingDraft();
    this.#docID = this.#getIdOfDraft();
    this.#currentDest = this.#getDestinationOfDraft();
    this.#currentStatus = this.#getStatusOfDraft();
    this.#currentTitle = this.#getTitleOfDraft();
    this.#data.scrubedTitle = this.#getScrubedTitleOfDraft();
    this.#inPipeline = this.#draftIsInPipeline();
  }

  get id() {
    return this.#docID;
  }

  get docID() {
    return this.#docID;
  }

  get docIDType() {
    return this.constructor.docIDType;
  }

  get record() {
    return this.#record;
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

    this.#record = record;
  }

  get title() {
    return this.#currentTitle;
  }

  get Title() {
    return this.title;
  }

  get scrubedTitle() {
    return this.#data.scrubedTitle;
  }

  get recordID() {
    return this?.record?.id;
  }

  get DraftsID() {
    return this.#docID;
  }

  get content() {
    return this.workingDraft.content;
  }

  get status() {
    return this.#currentStatus;
  }

  set status(newStatus) {
    this.#currentStatus = newStatus;

    if (this.inPipeline) newStatus = `${this.#defaultTag}::${newStatus}`;
    this.workingDraft.addTag(newStatus);
    this.workingDraft.update();
  }

  get statusIsNotSet() {
    return this.#currentStatus == "";
  }

  get destination() {
    return this.#currentDest;
  }

  set destination(newDest) {
    // Check if newDest exists in Destinations
    if (this.#destinations.isValidKey(newDest) == false) return;

    // If it does add it as a tag
    this.workingDraft.addTag(newDest);
    this.workingDraft.update();
    this.#currentDest = newDest;
  }

  get destinationIsNotSet() {
    return this.#currentDest == "";
  }

  get airtableDestination() {
    return this.#destinations.lookupAirTableDestinationName(this.destination);
  }

  get inPipeline() {
    return this.#inPipeline;
  }

  set inPipeline(value) {
    if (typeof value !== "boolean") return;

    if (value) {
      this.workingDraft.removeTag(this.#defaultTag);
      this.workingDraft.removeTag(this.status);
      this.workingDraft.addTag(`${this.#defaultTag}::${this.status}`);
      this.workingDraft.isArchived = true;
      this.workingDraft.update();
    }
    this.#inPipeline = value;
  }

  static load(dests, record) {
    return new DraftsDoc(dests, record);
  }

  open() {
    const workspace = Workspace.find("default");
    app.applyWorkspace(workspace);
    editor.load(this.workingDraft);
    editor.activate();
  }

  save() {
    this.workingDraft.update();
  }

  delete() {
    this.workingDraft.isTrashed = true;
    this.workingDraft.update();
  }

  #findOrCreateWorkingDraft() {
    if (this?.record?.docID != undefined) return Draft.find(this.record.docID);

    this.#currentDest = this.#destinations.select();
    if (this.destination == "") return;

    const templateDraft = this.#template_factory.create({
      destination: this.destination,
      templateName: this.#destinations.lookupTemplate(this.destination),
    });

    return templateDraft.draft;
  }

  #getIdOfDraft() {
    return this.record?.docID != undefined
      ? this.record.docID
      : this.workingDraft?.uuid;
  }

  #getDestinationOfDraft() {
    if (this.workingDraft == undefined) return undefined;

    const checkDestFunction = (testDraft) => (dest) => {
      return testDraft.hasTag(dest);
    };
    const hasDest = checkDestFunction(this.workingDraft);

    return this.#destinations.getCurrentDestination(hasDest);
  }

  #getStatusOfDraft() {
    if (this.workingDraft == undefined) return undefined;

    const defaultTag = this.#defaultTag;
    const checkStatusFunction = (testDraft) => (status) => {
      return (
        testDraft.hasTag(`${defaultTag}::${status}`) || testDraft.hasTag(status)
      );
    };
    const hasStatus = checkStatusFunction(this.workingDraft);

    return this.#statuses.getCurrentStatus(hasStatus);
  }

  #getTitleOfDraft() {
    if (this.workingDraft == undefined) return undefined;

    return this.record?.Title != undefined
      ? this.record.Title
      : this.workingDraft.displayTitle;
  }

  #getScrubedTitleOfDraft() {
    const scrubText = this.#destinations.getScrubText(this.destination);
    return this.#text.scrubTitle(this.title, scrubText);
  }

  #draftIsInPipeline() {
    if (this.workingDraft == undefined) return false;
    return this.workingDraft.hasTag(`${this.#defaultTag}::${this.status}`);
  }
}
