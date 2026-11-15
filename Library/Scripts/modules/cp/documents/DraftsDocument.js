require("modules/cp/templates/template_factory.js");
if (typeof DraftsRuntime == "undefined") require("shared/libraries/DraftsRuntime.js");

class DraftsDoc {
  static docIDType = "DraftsID";
  #dependencyProvider;
  #ui;
  #text;
  #settings;
  #template_factory;

  #data = {};
  #docID;
  #record;
  #currentDest;
  #currentStatus;
  #currentTitle;
  #inPipeline;

  constructor(dependencyProvider, settings, record = {}) {
    this.#dependencyProvider = dependencyProvider;
    this.#ui = dependencyProvider.ui;
    this.#text = dependencyProvider.textUtilities;
    this.#settings = settings;
    this.#template_factory = new TemplateFactory(dependencyProvider);

    this.#record = record;
    this.workingDraft = this.#findOrCreateWorkingDraft();
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

  get id() {
    return this.docID;
  }

  get docID() {
    if (this.#docID == undefined) this.#docID = this.#getIdOfDraft();

    return this.#docID;
  }

  get docIDType() {
    return this.constructor.docIDType;
  }

  get record() {
    return this.#record;
  }

  set record(record) {
    if (record?.docID == undefined) {
      return this.#ui.displayAppMessage(
        "error",
        "Record does not have an id!",
        {
          class: "DraftsDocument",
          function: "set record()",
          record: record,
          methods: Object.getOwnPropertyNames(record),
          type: record.constructor.name,
          docID: record.docID,
        },
      );
    }

    if (record.docID != this.docID) {
      record.docID = this.docID;
      record.docIDType = this.docIDType;
    }

    this.#record = record;
  }

  get title() {
    if (this.#currentTitle == undefined) {
      this.#currentTitle = this.#getTitleOfDraft();
    }

    return this.#currentTitle;
  }

  get Title() {
    return this.title;
  }

  get scrubedTitle() {
    if (this.#data.scrubedTitle == undefined) {
      this.#data.scrubedTitle = this.#getScrubedTitleOfDraft();
    }

    return this.#data.scrubedTitle;
  }

  get slug() {
    if (this.#data.slug == undefined) {
      this.#data.slug = this.#text.convertTitleToSlug(this.scrubedTitle);
    }

    return this.#data.slug;
  }

  get recordID() {
    return this?.record?.id;
  }

  get DraftsID() {
    return this.#docID;
  }

  get content() {
    return this.workingDraft?.content;
  }

  get status() {
    if (this.#currentStatus == undefined) {
      this.#currentStatus = this.#getStatusOfDraft();
    }

    return this.#currentStatus;
  }

  set status(newStatus) {
    this.#currentStatus = newStatus;

    // Check if workingDraft exists before trying to modify it
    if (this.workingDraft == undefined) {
      this.#logMissingDraft("set status");
      return;
    }

    if (this.inPipeline) newStatus = `${this.#defaultTag}::${newStatus}`;
    this.workingDraft.addTag(newStatus);
    this.workingDraft.update();
  }

  get statusIsNotSet() {
    return this.status == "";
  }

  get destination() {
    if (this.#currentDest == undefined) {
      this.#currentDest = this.#getDestinationOfDraft();
    }

    return this.#currentDest;
  }

  set destination(newDest) {
    // Check if newDest exists in Destinations
    if (this.#destinations.isValidKey(newDest) == false) return;

    // Check if workingDraft exists before trying to modify it
    if (this.workingDraft == undefined) {
      this.#logMissingDraft("set destination");
      return;
    }

    // If it does add it as a tag
    this.workingDraft.addTag(newDest);
    this.workingDraft.update();
    this.#currentDest = newDest;
  }

  get destinationIsNotSet() {
    return this.destination == "" || this.destination == undefined;
  }

  get airtableDestination() {
    return this.#destinations.lookupAirTableDestinationName(this.destination);
  }

  get inPipeline() {
    if (this.#inPipeline == undefined) {
      this.#inPipeline = this.#draftIsInPipeline();
    }

    return this.#inPipeline;
  }

  set inPipeline(value) {
    if (typeof value !== "boolean") return;

    // Check if workingDraft exists before trying to modify it
    if (this.workingDraft == undefined) {
      this.#logMissingDraft("set inPipeline");
      return;
    }

    if (value) {
      this.workingDraft.removeTag(this.#defaultTag);
      this.workingDraft.removeTag(this.status);
      this.workingDraft.addTag(`${this.#defaultTag}::${this.status}`);
      this.workingDraft.isArchived = true;
      this.workingDraft.update();
    } else {
      this.#leavePipeline();
    }
    this.#inPipeline = value;
  }

  open() {
    if (this.workingDraft == undefined) {
      return this.#logMissingDraft("open");
    }
    // Drafts' built-in workspace, shown as "Default". No workspace is named
    // "default", so find() returns undefined and applyWorkspace resets to it
    DraftsRuntime.loadWorkspace("default", "Default");
    editor.load(this.workingDraft);
    editor.activate();
  }

  save() {
    if (this.workingDraft == undefined) {
      return this.#logMissingDraft("save");
    }
    this.workingDraft.update();
  }

  delete() {
    if (this.workingDraft == undefined) {
      return this.#logMissingDraft("delete");
    }
    this.workingDraft.isTrashed = true;
    this.workingDraft.update();
  }

  // Removes the pipeline and status tags and moves the draft back to the
  // inbox. A draft outside the pipeline has no status.
  #leavePipeline() {
    const defaultTag = this.#defaultTag;
    const statusList = this.#statuses.statusList;
    const isPipelineTag = (tag) =>
      tag == defaultTag || tag.startsWith(`${defaultTag}::`) || statusList.includes(tag);

    this.workingDraft.tags.filter(isPipelineTag).forEach((tag) => this.workingDraft.removeTag(tag));
    this.workingDraft.isArchived = false;
    this.workingDraft.update();
    this.#currentStatus = "";
  }

  // Records a change that was dropped because there is no draft to apply it to.
  #logMissingDraft(action) {
    this.#ui.logError(`[DraftsDoc] Cannot ${action}: workingDraft is undefined`, {
      class: "DraftsDoc",
      action: action,
      docID: this.#record?.docID,
    });
  }

  #findOrCreateWorkingDraft() {
    // findDraft returns the global draft when it is the target, so changes
    // are not reverted when the script step ends
    if (this?.record?.docID != undefined) return DraftsRuntime.findDraft(this.record.docID);

    this.#currentDest = this.#destinations.select();
    if (this.destination == "") return;

    const templateDraft = this.#template_factory.create({
      destination: this.destination,
      templateName: this.#destinations.lookupTemplate(this.destination),
      uiSettings: this.#settings.createNewDraft,
    });

    // Check if template creation was successful
    if (templateDraft == undefined) {
      this.#ui.debugLog("[DraftsDoc] Template creation cancelled or failed");
      return undefined;
    }

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
