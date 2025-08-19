// Content Pipeline Files
require("cp/Statuses.js");
require("cp/Destinations.js");
require("cp/RecentRecords.js");
require("cp/TextUtilities.js");
require("cp/ui/DraftsUI.js");
require("cp/filesystems/CloudFS.js");
require("cp/databases/AirTableDB.js");
require("cp/documents/document_factory.js");
require("cp/templates/template_factory.js");

class ContentPipeline {
  static basePath = "/Library/Data/cp/";
  static settingsFile = "cp/settings.yaml";
  #fs;
  #ui;
  #db;
  #text;
  #recent;
  #statuses;
  #settings;
  #tableName;
  #activeDoc;
  #destinations;
  #document_factory;

  constructor(table = "Content") {
    this.#tableName = table;
    this.#fs = new CloudFS(this.basePath);
    this.#settings = new Settings(this.settingsFile);
    this.#ui = new DraftsUI(this.#settings.ui);
    this.#text = new TextUltilities();

    const dependancies = {
      ui: this.#ui,
      fileSystem: this.#fs,
      settings: this.#settings,
      tableName: this.#tableName,
      defaultTag: this.#settings.defaultTag[table],
      textUltilities: this.#text,
    };

    this.#statuses = new Statuses(dependancies);
    dependancies["statuses"] = this.#statuses;

    this.#destinations = new Destinations(dependancies);
    dependancies["destinations"] = this.#destinations;

    this.#recent = new RecentRecords(dependancies);
    dependancies["recentRecords"] = this.#recent;

    this.#db = new AirTableDB(dependancies);
    dependancies["database"] = this.#db;

    this.#document_factory = new DocumentFactory(dependancies);
    this.#activeDoc = null;

    this.#loadWorkspace();
  }

  // **************
  // * Getter and Setter functions
  // **************
  // Turns on and off debug logging for Ulysses and Airtable
  set debug(value) {
    if (value == false) return;

    this.#db.debug = true;
    this.#ui.debug = true;
  }

  get tableName() {
    return this.#tableName;
  }

  get settingsFile() {
    return this.constructor.settingsFile;
  }

  get dirPrefix() {
    return this.#settings.dirPrefix;
  }

  get basePath() {
    return this.constructor.basePath;
  }

  get databaseError() {
    return this.#db.databaseError;
  }

  get activeDocInPipeline() {
    return this.#db.docIsInPipeline(this.#activeDoc);
  }

  get activeDocIsUndefined() {
    return this.#activeDoc == undefined;
  }

  get recentRecordsUpdated() {
    return this.#recent.save(this.#activeDoc);
  }

  // **************
  // * Welcome
  // * Startup function
  // **************
  welcome() {
    // Retrieve settings for welcome prompt
    const { menuPicker, menuSettings, errorMessage } =
      this.#ui.settings("welcome");

    // Create menuPicker from recent records
    this.#ui.utilities.addRecordColomsToMenuPicker(
      menuPicker,
      menuSettings,
      this.#recent.records
    );

    // Build and display the menu prompt
    // Exit is cancel has been pressed
    const welcomeScreen = this.#ui.buildMenu(menuSettings);
    if (welcomeScreen.show() == false) return context.cancel();

    // Record input from prompt
    const nextFunction = welcomeScreen.buttonPressed;
    const index = this.#ui.utilities.getIndexFromPromptPicker(
      welcomeScreen,
      menuPicker
    );
    const record = this.#recent.selectByIndex(index);

    this.#activeDoc = this.#document_factory.load(record);

    // Calls the next function using the value returned by welcomeScreen.buttonPressed
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * openDoc()
  // * Open content in Drafts or Ulysses
  // **************
  openDoc(docID, docIDType) {
    const { docNotFound, recentDocsNotSaved } = this.#settings.openDoc;

    if (this.#activeDoc == undefined)
      this.#activeDoc = this.#document_factory.load({
        docID: docID,
        docIDType: docIDType,
      });

    if (this.#activeDoc == undefined)
      return this.#ui.displayAppMessage("error", docNotFound, {
        errorMessage: docNotFound,
        acticeDoc: this.#activeDoc,
      });

    if (this.recentRecordsUpdated != true)
      this.#ui.displayAppMessage("info", recentDocsNotSaved, {
        recentRecordsUpdated: false,
        activeDoc: this.#activeDoc,
      });

    this.#activeDoc.open();
  }

  // **************
  // * useCurrentDraft()
  // * Choses action to run on the active draft
  // **************
  useCurrentDraft() {
    // Retrieve settings for useCurrentDraft
    const { menuSettings } = this.#ui.settings("useCurrentDraft");
    if (draft.content == "")
      return this.#ui.displayAppMessage("info", "Cannot use a blank draft!");

    this.#activeDoc = this.#document_factory.load({
      docID: draft.uuid,
      docIDType: "DraftsID",
    });

    // Build and display the menu prompt
    // Exit is cancel has been pressed
    const menu = this.#ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    // Calls the next function using the value returned by .buttonPressed
    this.#functionToRunNext(menu.buttonPressed);
  }

  // **************
  // * addContent()
  // *
  // **************
  addContent() {
    // Retrieve settings
    const { menuSettings } = this.#ui.settings("addContent");

    // Build and display the menu prompt
    // Exit is cancel has been pressed
    const menu = this.#ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    // Calls the next function using the value returned by welcomeScreen.buttonPressed
    this.#functionToRunNext(menu.buttonPressed);
  }

  // **************
  // * deleteContent()
  // * Removes documents from Recent Records, AirTable, from an app, or everywhere
  // **************
  deleteContent() {
    // Retrieve settings
    const { menuSettings } = this.#ui.settings("addContent");
    if (this.#activeDoc == undefined) return;

    // Build and display the menu prompt
    // Exit is cancel has been pressed
    const menu = this.#ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    switch (menu.buttonPressed) {
      case "everywhere":
        this.#activeDoc.delete();
      case "database":
        this.#db.delete(this.#activeDoc);
        // How does this get updated if the doc has been deleted?
        this.#activeDoc.inPipeline = false;
      case "recentRecords":
        this.#recent.delete(this.#activeDoc);
    }
  }

  // **************
  // * createNewDoc()
  // * Creates a new Document from a template or a black with a destination tag
  // **************
  createNewDoc() {
    this.#activeDoc = this.#document_factory.create("draft");
    this.#activeDoc.save();

    this.addDocToPipeline();
    this.#activeDoc.open();
  }

  // **************
  // * selectDocByStatus()
  // * Pick a post to work with based off a Status
  // **************
  selectDocByStatus() {
    const { menuSettings, menuPicker } = this.#ui.settings("selectDocByStatus");

    // Check or ask for status and retrieve corresponding records
    const status = this.#statuses.select();

    if (menuSettings.menuItems.length > 3) menuSettings.menuItems.pop();
    const records = this.#db.retrieveRecordsByField("Status", status);
    if (this.databaseError) return this.#throwDBError("selectDocByStatus()");

    menuPicker["columns"] = this.#ui.utilities.createPickerFromRecords(records);
    menuSettings.menuItems.push({ type: "picker", data: menuPicker });

    // Prompts for title and status
    const menu = this.#ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    // Set _activeRecord to the selected record and run next function
    const index = menu.fieldValues[menuPicker.name];
    this.#activeDoc = this.#document_factory.load(records[index]);
    this.#functionToRunNext(menu.buttonPressed);
  }

  // **************
  // * modifyActiveDoc()
  // * Prompts to perform action on this.#activeDoc
  // **************
  modifyActiveDoc(docIDType, docID) {
    const { errorMessage, menuSettings } = this.#ui.settings("modifyActiveDoc");

    if (this.#activeDoc == undefined)
      this.#activeDoc = this.#document_factory.load({
        docID: docID,
        docIDType: docIDType,
      });

    if (this.#activeDoc == undefined)
      return this.#ui.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "ContentPipeline",
        function: "modifyActiveDoc()",
        docIDType: docIDType,
        docID: docID,
      });

    if (this.#activeDoc.docIDType == "DraftsID")
      menuSettings.menuItems.push({
        type: "button",
        data: {
          name: "Convert Draft to Other Document",
          value: "convertDraft",
        },
      });
    menuSettings.menuMessage = menuSettings.menuMessage.concat(
      this.#activeDoc.title
    );

    // Prompts for title and status
    const menu = this.#ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    this.#functionToRunNext(menu.buttonPressed);
  }

  // **************
  // * addDocToPipeline()
  // * Adds doc to the Productively Pipeline in Airtable
  // **************
  addDocToPipeline(docIDType, docID = undefined) {
    const {
      successMessage,
      errorMessage,
      docExistsMessage,
      infoMessage,
      menuSettings,
    } = this.#ui.settings("addDocToPipeline");

    // Load document if #activeDoc is not set
    if (this.activeDocIsUndefined)
      this.#activeDoc = this.#document_factory.load({
        docID: docID,
        docIDType: docIDType,
      });

    // Check if doc is already in pipeline
    if (this.activeDocInPipeline)
      return this.#ui.displayAppMessage("info", docExistsMessage);
    if (this.databaseError) return this.#throwDBError("addDocToPipeline()");

    // Prompt to add doc to pipeline
    if (this.#ui.yesNoPrompt(menuSettings) === "no") {
      this.#ui.displayAppMessage("info", infoMessage);
      return false;
    }

    // Select Status & destination
    if (this.#activeDoc.statusIsNotSet)
      this.#activeDoc.status = this.#statuses.select(this.#activeDoc.title);
    if (this.#activeDoc.destinationIsNotSet)
      this.#activeDoc.destination = this.#destinations.select(
        this.#activeDoc.title
      );

    // Update pipeline with activeDoc
    if (this.#updateDatabase() == false)
      return this.#ui.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "ContentPipeline",
        function: "addDocToPipeline()",
        activeDoc: this.#activeDoc,
      });
    if (this.databaseError) return this.#throwDBError("addDocToPipeline()");

    // Update and save draft
    this.#activeDoc.record = this.#db.currentRecord;
    this.#activeDoc.inPipeline = true;

    // If Airtable responds with a valid record
    // add the record to recent records and return it
    const warningMessage = "Recent Records could not be saved!";
    if (this.#updateRecentRecords() == false)
      this.#ui.displayAppMessage("warning", warningMessage, {
        warningMessage: warningMessage,
        errorType: "execution",
        class: "AirTableDB",
        function: "updateUsingDoc()",
        doc: doc,
        record: doc.record,
        savedRecord: savedRecord,
        stackTrace: this.#recent.stackTrace,
      });

    this.#ui.displayAppMessage("success", successMessage);
    return true;
  }

  // **************
  // * addDefaultNotesToSheet()
  // * Adds an existing Ulysses sheet to the pipeline
  // **************
  addDefaultNotesToSheet(targetId) {
    // Retrieve settings
    const {
      infoMessage,
      errorMessage1,
      errorMessage2,
      successMessage,
      menuSettings,
    } = this.#ui.settings("addSheetToPipeline");

    if (this.#activeDoc == undefined)
      this.#activeDoc = this.#document_factory.load({
        docID: targetId,
        docIDType: "UlyssesID",
      });

    // Remove existing note, add default notes to top, then reapply old notes.
    this.#activeDoc.attachDefaultNotes();
  }

  // **************
  // * convertDraft()
  // * Adds draft to Ulysses, Updates Pipeline, and moves draft into trash
  // **************
  convertDraft(uuid = draft.uuid) {
    const { recentDocsNotSaved } = this.#ui.settings("convertDraft");

    if (this.#activeDoc == undefined)
      this.#activeDoc = this.#document_factory.load({
        docID: uuid,
        docIDType: "DraftsID",
      });

    const record = this.#db.retrieveRecordByDocID(this.#activeDoc);
    if (record == undefined) this.addDocToPipeline();

    this.#activeDoc.record = record;

    const { newDocType } = this.#destinations.lookupDocConvertionData(
      this.#activeDoc.destination
    );
    this.#convertActiveDoc(newDocType);

    if (this.recentRecordsUpdated != true)
      this.#ui.displayAppMessage("info", recentDocsNotSaved, {
        savedRecent: savedRecent,
        activeDoc: this.#activeDoc,
      });

    this.#ui.displayAppMessage(
      "success",
      `Draft has been converted to a ${newDocType}.`
    );
  }

  // **************
  // * updateStatusOfDoc()
  // * Updates the status of a document
  // **************
  updateStatusOfDoc(docID, docIDType) {
    const { statusList } = this.#settings;
    const { errorMessage, errorMessage2, successMessage, menuSettings } =
      this.#ui.settings("updateStatusOfDoc");
    if (this.#activeDoc == undefined)
      this.#activeDoc = this.#document_factory.load({
        docID: docID,
        docIDType: docIDType,
      });

    if (this.#activeDoc == undefined)
      return this.#ui.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "ContentPipeline",
        function: "updateStatusOfDoc()",
        docID: docID,
        docIDType: docIDType,
      });

    if (this.#activeDoc.title == undefined)
      return this.#ui.displayAppMessage("error", errorMessage2, {
        errorMessage: errorMessage2,
        class: "ContentPipeline",
        function: "updateStatusOfDoc()",
        activeDoc: this.#activeDoc,
      });

    // Check if doc is already in pipeline and retrieve record
    if (this.#activeDoc.inPipeline == false && this.addDocToPipeline() == false)
      return;
    this.#activeDoc.record = this.#db.retrieveRecordByDocID(this.#activeDoc);
    if (this.databaseError) return this.#throwDBError("updateStatusOfDoc()");

    // Create and show menu
    menuSettings["menuItems"] = this.#statuses.generateStatusMenuItems(
      this.#activeDoc.status
    );
    menuSettings.menuMessage += `${this.#activeDoc.title} is '${this.#activeDoc.status
      }.'`;
    const menu = this.#ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    // Save button choice as newStatus
    const newStatus = menu.buttonPressed;
    if (newStatus == "back") return this.#functionToRunNext("modifyActiveDoc");
    this.#activeDoc.status = newStatus;

    const { covertDoc, newDocType } =
      this.#destinations.lookupDocConvertionData(
        this.#activeDoc.destination,
        newStatus
      );
    if (covertDoc) this.#convertActiveDoc(newDocType);

    this.#updateRecentRecords();
    this.#updateDatabase();
    if (this.databaseError) return this.#throwDBError("updateStatusOfDoc()");

    // Display Success Message when Pipeline has been update
    this.#ui.displayAppMessage("success", successMessage + newStatus);
    return true;
  }

  // **************
  // * syncStatusOfSheet()
  // * Updates the status of a sheet based on it's AirTable Record
  // **************
  syncStatusOfSheet(targetId) {
    const docData = { docID: targetId, docIDType: "UlyssesID" };
    const record = this.#db.retrieveRecordByDocID(docData);
    const errorMessage = "No record found with that Target ID!";

    if (record == undefined)
      return this.#ui.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "ContentPipeline",
        function: "syncStatusOfSheet()",
        targetId: targetId,
        docData: docData,
        record: record,
      });

    this.#activeDoc = this.#document_factory.load(docData);
    this.#activeDoc.status = record.Status;
  }

  // **************
  // * getPublishedPostURL()
  // * Returns the URL of a post that has been published
  // **************
  getPublishedPostURL(year = new Date().getFullYear()) {
    const { menuSettings, menuPicker } = this.#ui.settings(
      "getPublishedPostURL"
    );
    const records = this.#db.retrieveRecordsByField(
      "Status",
      `Published ${year}✨`,
      {
        field: "Publish Date",
        direction: "desc",
      }
    );

    // Build MenuPicker with published posts
    if (menuSettings.menuItems.length > 2) menuSettings.menuItems.pop();
    menuPicker["columns"] = this.#ui.utilities.createPickerFromRecords(records);
    menuSettings.menuItems.push({ type: "picker", data: menuPicker });

    // Display menu to select a post
    const menu = this.#ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    const nextFunction = menu.buttonPressed;
    if (nextFunction == "getPublishedPostURL") {
      const newYear = this.#selectYear();
      if (newYear == undefined) return context.cancel();

      return this.#functionToRunNext(nextFunction, newYear);
    }

    // Set active record to chosen record
    const index = menu.fieldValues[menuPicker.name];
    return records[index]?.Link;
  }

  // **************
  // * Private Functions
  // **************
  #functionToRunNext(name, args) {
    const errorMessage = "Function name missing!";

    if (name == undefined)
      return this.#ui.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "ContentPipeline",
        function: "#functionToRunNext()",
        name: name,
      });
    if (Array.isArray(args) == false) args = [args];
    // Log & run function
    console.log(`\n\n#######\nRunning function: ${name}`);
    return this[name].apply(this, args);
  }

  #throwDBError(parentFunction) {
    this.#db.stackTrace["parentFunction"] = parentFunction;
    this.#ui.displayAppMessage("error", "Database Error!", this.#db.stackTrace);
  }

  #updateDatabase() {
    return this.#db.updateUsingDoc(this.#activeDoc);
  }

  #updateRecentRecords() {
    return this.#recent.save(this.#activeDoc);
  }

  #convertActiveDoc(newDocType) {
    if (this.#activeDoc == undefined || newDocType == undefined) return false;
    const errorMessage = "Document could not be created!";

    // Create New Doc
    const newDoc = this.#document_factory.create(newDocType);
    if (newDoc == undefined || newDoc == false) return false;

    newDoc.status = this.#activeDoc.status;
    newDoc.destination = this.#activeDoc.destination;
    newDoc.content = this.#activeDoc.content;
    if (newDoc.save() == false)
      return this.#ui.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "ContentPipeline",
        function: "#convertActiveDoc()",
        docType: newDoc.docIDType,
        stackTrace: newDoc?.stackTrace,
      });

    // Update Airtable
    newDoc.record = this.#activeDoc.record;
    const success = this.#db.updateUsingDoc(newDoc);
    if (this.databaseError) return this.#throwDBError("convertActiveDoc()");

    // Delete old doc and update activeDoc
    this.#activeDoc.delete();
    this.#activeDoc = newDoc;

    return true;
  }

  #selectYear() {
    const { infoMessage, menuSettings } = this.#ui.settings("selectYear");
    const chooseYear = this.#ui.buildMenu(menuSettings);
    chooseYear.show();

    // Return string of selected year
    const index = chooseYear.fieldValues["year"][0];
    return menuSettings.menuItems[0].data.columns[0][index];
  }

  #loadWorkspace() {
    const { defaultWorkspace } = this.#settings;
    const workspace = Workspace.find(defaultWorkspace);
    app.applyWorkspace(workspace);
  }
}
