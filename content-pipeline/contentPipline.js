require("draftsTable.js");
require("ulysses-v2.js");
require("cp/model.js");
require("cp/view.js");
require("cp/utilities.js");

class ContentPipeline {
  #filesPath = "/Library/Data/";
  #tableName;

  constructor(table = "Content") {
    this.#tableName = table;
    this._settings = this._parseJSONFromiCloudFile("settings.json");
    this._destinations = this._parseJSONFromiCloudFile(this._settings.destinationsFile)[this.tableName];
    this._recentRecords = this._parseJSONFromiCloudFile(this._settings.recentRecordsFile)[this.tableName];
    this._table = new Airtable().base().table(table);
    this._ulysses = new Ulysses();
    this._activeRecord = null;
    this._buttons = false;
    this._debug = false;
  }

  // Turns on and off debug logging for Ulysses and Airtable
  set debug(value) {
    const { errorMessage } = this._settings.debug;
    if (!typeof value === "boolean") return this._displayErrorMessage(errorMessage);

    this._debug = value;
    this._ulysses.debug = value;
    this._table.debug = value;
  }

  // Turns on and off Button UI for choosing posts
  // Default is off, which displays a select menu for choosing posts
  set buttons(value) {
    const { buttons: errorMessage } = this._settings;
    if (!typeof value === "boolean") return this._displayErrorMessage(errorMessage);

    this._buttons = value;
  }

  get tableName() {
    return this.#tableName;
  }

  get filesPath() {
    return this.#filesPath;
  }

  // **************
  // * Welcome
  // * Startup function
  // **************
  welcome() {
    // Retrieve settings for welcome prompt
    const { menuPicker, menuSettings, errorMessage } = this._settings.welcome;
    if (!menuPicker["columns"]) {
      menuPicker["columns"] = this._createPickerFromRecords(this._recentRecordsV2);
      menuSettings.menuItems.push({ type: "picker", data: menuPicker });
    }

    // Build and display the menu prompt
    // Exit is cancel has been pressed
    const welcomeScreen = this._buildMenu(menuSettings);
    if (!welcomeScreen.show()) return context.cancel();

    // Record input from prompt
    const nextFunction = welcomeScreen.buttonPressed;
    this._activeRecord = ATRecord.create(this._getRecordFromPromptPicker(welcomeScreen, menuPicker));

    const draftsID = this._activeRecord?.DraftsID;
    if (draftsID) return this._functionToRunNext(nextFunction, [draftsID, "DraftsID"]);

    const ulyssesID = this._activeRecord?.UlyssesID;
    if (ulyssesID) return this._functionToRunNext(nextFunction, [ulyssesID, "UlyssesID"]);

    // Calls the next function using the value returned by welcomeScreen.buttonPressed
    this._functionToRunNext(nextFunction, this._activeRecord.id);
  }

  // **************
  // * useCurrentDraft()
  // * Choses action to run on the active draft
  // **************
  useCurrentDraft() {
    // Retrieve settings for useCurrentDraft
    const { menuSettings } = this._settings.useCurrentDraft;

    // Build and display the menu prompt
    // Exit is cancel has been pressed
    const menu = this._buildMenu(menuSettings);
    if (!menu.show()) return context.cancel();

    // Calls the next function using the value returned by .buttonPressed
    this._functionToRunNext(menu.buttonPressed, draft);
  }

  // **************
  // * addContent()
  // *
  // **************
  addContent() {
    // Retrieve settings
    const { menuSettings } = this._settings.addContent;

    // Build and display the menu prompt
    // Exit is cancel has been pressed
    const menu = this._buildMenu(menuSettings);
    if (!menu.show()) return context.cancel();

    // Calls the next function using the value returned by welcomeScreen.buttonPressed
    this._functionToRunNext(menu.buttonPressed);
  }

  // **************
  // * createNewDraft()
  // * Creates a new Draft from a template or a black with a destination tag
  // **************
  createNewDraft() {
    // Load settings and create a new draft object
    const {
      createNewDraft: { infoMessage, menuSettings },
    } = this._settings;
    let newDraft = new Draft();

    // Check to see if a destination has been set
    const destination = this._selectDestination();
    if (!destination) return this._displayInfoMessage(infoMessage);
    newDraft.addTag(destination);

    // Checks to see if a nextAction has been set in the Destinations JSON file
    const nextAction = this._lookupActionBy(destination);
    if (nextAction) return app.queueAction(nextAction, newDraft);

    // Prompts for title and status
    const menu = this._buildMenu(menuSettings);
    if (!menu.show()) return context.cancel();

    const title = this._getTextFieldValueFromMenu(menu);
    const status = menu.buttonPressed;
    newDraft.content = `# ${title}\n\n`;
    newDraft.addTag(status);

    this.addDraftToPipeline(newDraft);
    this._loadDraft(newDraft);
  }

  // **************
  // * addSheetToPipeline()
  // * Adds an existing Ulysses sheet to the pipeline
  // **************
  addSheetToPipeline(sheetID) {
    // Retrieve settings
    const { excerptText } = this._settings;
    const { infoMessage, errorMessage, successMessage, menuSettings } = this._settings.addSheetToPipeline;

    if (!sheetID) {
      // Build and display the menu prompt
      // Exit if cancel has been pressed
      const menu = this._buildMenu(menuSettings);
      if (!menu.show()) return context.cancel();

      sheetID = this._getTextFieldValueFromMenu(menu);
    }

    this._activeRecord = this._retrieveRecordByField("UlyssesID", sheetID);
    if (this._activeRecord) return this._displayInfoMessage(infoMessage);

    // Lookup info about the sheet
    const sheet = this._retrieveSheetById(sheetID);
    const status = this._returnStatusOfSheet(sheet);
    const destination = this._returnDestinationOfSheet(sheet);

    // Create new Airtable Record
    const fields = {
      UlyssesID: sheetID,
      Destination: this._lookUpAirTableFieldName(destination),
      Title: this._scrubTitle(sheet.title, destination),
      Status: status,
      Priority: "Low",
    };
    this._activeRecord = this._createRecordWith(fields);

    // Save to Pipeline
    if (!this._saveActiveRecord())
      return this._displayErrorMessage(errorMessage, { function: "addSheetToPipeline", ...fields });

    // Add default notes to sheet
    this._attachDefaultNotes(sheet.targetId);
    // this._updateDraftWithTag(workingDraft, status);
    // this._updateDraftWithTag(workingDraft, destination);
    // defualtTags.forEach((tag) => this._updateDraftWithTag(workingDraft, tag));
    app.displaySuccessMessage(successMessage);
    return true;
  }

  // **************
  // * addDraftToPipeline()
  // * Adds draft to the Productively Pipeline in Airtable
  // **************
  addDraftToPipeline(workingDraft = draft) {
    const {
      defualtTags,
      addDraftToPipeline: { infoMessage, errorMessage, successMessage },
    } = this._settings;
    this._activeRecord = this._retrieveRecordByField("DraftsID", workingDraft.uuid);
    if (this._activeRecord) return this._displayInfoMessage(infoMessage);

    // Select Status & destination
    const status = this._returnStatusOfDraft(workingDraft);
    const destination = this._returnDestinationOfDraft(workingDraft);

    // Create new Airtable Record
    const fields = {
      DraftsID: workingDraft.uuid,
      Destination: this._lookUpAirTableFieldName(destination),
      Title: this._scrubTitle(workingDraft.displayTitle, destination),
      Status: status,
      Priority: "Low",
    };
    this._activeRecord = this._createRecordWith(fields);

    // Save to Pipeline
    if (!this._saveActiveRecord())
      return this._displayErrorMessage(errorMessage, { function: "addDraftToPipeline", ...fields });

    // Update and save draft
    this._updateDraftWithTag(workingDraft, status);
    this._updateDraftWithTag(workingDraft, destination);
    defualtTags.forEach((tag) => this._updateDraftWithTag(workingDraft, tag));
    app.displaySuccessMessage(successMessage);
    this._debugVariable(this._activeRecord, "Created Acitve Record: ");
    return true;
  }

  // **************
  // * selectContentByStatus()
  // * Pick a post to work with based off a Status
  // **************
  selectContentByStatus() {
    let status = "";
    const { menuSettings, menuPicker } = this._settings.selectContentByStatus;

    // Check or ask for status and retrieve corresponding records
    if (!status) status = this._selectStatus();
    const records = this._retrieveRecordsByField("Status", status);
    menuPicker["columns"] = this._createPickerFromRecords(records);
    menuSettings.menuItems.push({ type: "picker", data: menuPicker });

    // Prompts for title and status
    const menu = this._buildMenu(menuSettings);
    if (!menu.show()) return context.cancel();

    // Set _activeRecord to the selected record and run next function
    const index = menu.fieldValues[menuPicker.name];
    this._activeRecord = records[index];
    this._functionToRunNext(menu.buttonPressed, this._activeRecord.id);
  }

  // **************
  // * modifyActiveRecord()
  // * Prompts to perform action on _activeRecord
  // **************
  modifyActiveRecord(recordID) {
    const { errorMessage, menuSettings } = this._settings.modifyActiveRecord;

    if (recordID) this._activeRecord = this._retrieveRecordById(recordID);
    if (!this._activeRecord)
      return this._displayErrorMessage(errorMessage, { function: "modifyActiveRecord", recordID: recordID });

    menuSettings.menuMessage = menuSettings.menuMessage.concat(this._activeRecord.Title);

    // Prompts for title and status
    const menu = this._buildMenu(menuSettings);
    if (!menu.show()) return context.cancel();

    this._functionToRunNext(menu.buttonPressed);
  }

  // **************
  // * openContent()
  // * Open content in Drafts or Ulysses
  // **************
  openContent(contentID, type = "AirTableID") {
    // What happens when ActiveRecord is already set?
    // Making another DB call is pointless
    if (!contentID)
      return this._displayErrorMessage("Content ID missing!", {
        function: "openContent",
        contentID: contentID,
        type: type,
      });
    if (type == "AirTableID") this._activeRecord = this._retrieveRecordById(contentID);

    this._saveRecentRecord();

    // Check for draftsId and open Draft if found
    const draftsID = type == "DraftsID" ? contentID : this._activeRecord?.DraftsID;
    if (draftsID) return this._loadDraft(Draft.find(draftsID));

    // Check for UlyssesID and open if found, add if not
    const ulyssesID = type == "UlyssesID" ? contentID : this._lookupTragetID();
    if (draftsID == undefined && ulyssesID == undefined)
      this._displayErrorMessage("Error: missing a valid Drafts ID or Ulysses ID. Cannot Continue!");

    this._ulysses.open(ulyssesID);
  }

  // **************
  // * updateCurrentDraft()
  // * Update the status of the current draft
  // **************
  updateCurrentDraft(workingDraft = draft) {
    const draftInPipeline = this._retrieveRecordByField("DraftsID", workingDraft.uuid);

    // If is not Pipeline prompt to add it
    // If adding it fails exit function
    if (!draftInPipeline && !this._addDraftToPipelinePrompt(workingDraft)) return context.cancel();

    return this.updateStatusOfRecord(draftInPipeline.id);
  }

  // **************
  // * sendDraftToUlysses()
  // * Adds draft to Ulysses, Updates Pipeline, and moves draft into trash
  // **************
  sendDraftToUlysses(workingDraft = draft) {
    // Searches Pipeline for Draft.uuid
    this._activeRecord = this._retrieveRecordByField("DraftsID", workingDraft.uuid);

    // If the a record is not found a prompt is generated asking to add Draft to Pipeline
    if (!this._activeRecord && !this._addDraftToPipelinePrompt(workingDraft)) return context.cancel();

    // Add draft to Ulysses
    const status = this._returnStatusOfDraft(workingDraft);
    const destination = this._getDestinationFromDraft(workingDraft);
    this._createSheetInUlyssesWith(workingDraft);

    // Update fields of _activeRecord and save
    this._activeRecord.addField("UlyssesID", this._ulysses.targetId);
    this._activeRecord.Title = this._scrubTitle(workingDraft.displayTitle, destination);
    this._activeRecord.Status = status;
    this._activeRecord.DraftsID = "";
    if (this._saveActiveRecord()) {
      workingDraft.isTrashed = true;
      workingDraft.update();
    }
  }

  // Update the status of content
  updateStatusOfRecord(contentID, type = "AirTableID") {
    const { statusList } = this._settings;
    const { errorMessage, errorMessage2, successMessage, menuSettings } = this._settings.updateStatusOfRecord;

    if (type == "AirTableID") this._activeRecord = this._retrieveRecordById(contentID);

    // Check for draftsId and open Draft if found
    const draftsID = type == "DraftsID" ? contentID : this._activeRecord?.DraftsID;
    if (draftsID) this._activeRecord = this._retrieveRecordByField("DraftsID", draftsID);

    // Check for UlyssesID and open if found, add if not
    const ulyssesID = type == "UlyssesID" ? contentID : this._activeRecord?.UlyssesID;
    if (ulyssesID) this._activeRecord = this._retrieveRecordByField("UlyssesID", ulyssesID);

    // Lookup record if recordID is provided
    if (!this._activeRecord)
      return this._displayErrorMessage(errorMessage, {
        function: "updateStatusOfRecord",
        contentID: contentID,
        type: type,
      });
    const currentStatus = this._activeRecord.Status;

    // Create and show menu
    menuSettings["menuItems"] = this._returnAvailableStatuses(statusList, currentStatus);
    menuSettings.menuMessage += `${this._activeRecord.Title} is '${this._activeRecord.Status}.'`;
    const menu = this._buildMenu(menuSettings);
    if (!menu.show()) return context.cancel();

    // Save button choice as newStatus
    const newStatus = menu.buttonPressed;

    // Update the Pipeline based on newStatus
    switch (newStatus) {
      case "back":
        return this._functionToRunNext("modifyActiveRecord");
        break;
      case "Writing":
        if (draftsID) this._addDraftToUlyssesPrompt(Draft.find(draftsID));
      default:
        this._updateSlugOfActiveRecord();
    }
    this._updateStatusOfDraft(draftsID, newStatus);
    this._updateStatusOfSheet(ulyssesID, newStatus);

    // Update ATRecord status and save changes
    this._activeRecord.Status = newStatus;
    if (!this._saveActiveRecord())
      return this._displayErrorMessage(errorMessage2, {
        function: "updateStatusOfRecord",
        recordData: JSON.stringify(this._activeRecord),
      });

    // Display Success Message when Pipeline has been update
    app.displaySuccessMessage(successMessage + newStatus);
    return true;
  }
}

// Active Record Functions - cp/model.js
ContentPipeline.prototype._saveActiveRecord = saveActiveRecord;
ContentPipeline.prototype._saveRecentRecord = saveRecentRecordV3;
ContentPipeline.prototype._retrieveRecentRecords = retrieveRecentRecordsV2;
ContentPipeline.prototype._updateSlugOfActiveRecord = updateSlugOfActiveRecord;
ContentPipeline.prototype._lookupTragetID = lookupTragetID;

// Drafts Functions - cp/model.js
ContentPipeline.prototype._returnStatusOfDraft = returnStatusOfDraft;
ContentPipeline.prototype._getDestinationFromDraft = returnDestinationOfDraft;
ContentPipeline.prototype._returnDestinationOfDraft = returnDestinationOfDraftV2;
ContentPipeline.prototype._updateStatusOfDraft = updateStatusOfDraft;
ContentPipeline.prototype._loadDraft = loadDraft;
ContentPipeline.prototype._updateDraftWithTag = updateDraftWithTag;
ContentPipeline.prototype._lookupActionBy = lookupActionBy;

// Ulysses Functions - cp/model.js
ContentPipeline.prototype._returnStatusOfSheet = returnStatusOfSheet;
ContentPipeline.prototype._returnDestinationOfSheet = returnDestinationOfSheet;
ContentPipeline.prototype._updateStatusOfSheet = updateStatusOfSheet;
ContentPipeline.prototype._createSheetInUlyssesWith = createSheetInUlyssesWith;
ContentPipeline.prototype._getItemsFromUlysses = getItemsFromUlyssesV1;
ContentPipeline.prototype._retrieveSheetById = retrieveSheetById;
ContentPipeline.prototype._attachDefaultNotes = attachDefaultNotes;

// AirTable Functions - cp/model.js
ContentPipeline.prototype._retrieveRecordById = retrieveRecordById;
ContentPipeline.prototype._retrieveRecordByField = retrieveRecordByField;
ContentPipeline.prototype._retrieveRecordsByField = retrieveRecordsByField;
ContentPipeline.prototype._lookUpAirTableFieldName = lookUpAirTableFieldName;
ContentPipeline.prototype._createRecordWith = createRecordWith;

// View Functions - cp/view.js
ContentPipeline.prototype._buildMenu = buildMenuV3;
ContentPipeline.prototype._selectStatus = selectStatus;
ContentPipeline.prototype._selectDestination = selectDestination;
ContentPipeline.prototype._addMissingTargetId = addMissingTargetId;
ContentPipeline.prototype._createPickerFromRecords = createPickerFromRecordsV3;
ContentPipeline.prototype._getRecordIdFromPromptPicker = getRecordIdFromPromptPickerV3;
ContentPipeline.prototype._getRecordFromPromptPicker = getRecordFromPromptPickerV3;
ContentPipeline.prototype._getTextFieldValueFromMenu = getTextFieldValueFromMenu;
ContentPipeline.prototype._addDraftToPipelinePrompt = addDraftToPipelinePrompt;
ContentPipeline.prototype._addDraftToUlyssesPrompt = addDraftToUlyssesPrompt;
ContentPipeline.prototype._returnAvailableStatuses = returnAvailableStatuses;
ContentPipeline.prototype._optionsWithBackButton = optionsWithBackButton;
ContentPipeline.prototype._statusIsNotLast = statusIsNotLast;

// Utility Functions - Utilities.js
ContentPipeline.prototype._displayInfoMessage = displayInfoMessage;
ContentPipeline.prototype._displayErrorMessage = displayErrorMessage;
ContentPipeline.prototype._continueWithWarning = continueWithWarning;
ContentPipeline.prototype._parseJSONFromiCloudFile = parseJSONFromiCloudFile;
ContentPipeline.prototype._functionToRunNext = functionToRunNext;
ContentPipeline.prototype._typeCheckString = typeCheckString;
ContentPipeline.prototype._debugVariable = debugVariable;
ContentPipeline.prototype._sleep = sleep;
ContentPipeline.prototype._lookUpDestinationID = lookUpDestinationID;

// Text Functions - Utilities.js
ContentPipeline.prototype._convertTitleToSlug = convertTitleToSlug;
ContentPipeline.prototype._titleCase = titleCase;
ContentPipeline.prototype._scrubTitle = scrubTitle;
