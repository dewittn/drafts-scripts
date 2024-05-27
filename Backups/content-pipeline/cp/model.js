// ********************
// ** Active Record Functions
// ********************

// Saves this._activeRecord to Airtable
function saveActiveRecord() {
  let result = false;
  // Remove any fields not included in this._settings.defaultFields
  // Prevents HTTP 422 response from AirTable
  for (const key of Object.keys(this._activeRecord._fields)) {
    if (!this._settings.defaultFields.includes(key)) delete this._activeRecord._fields[key];
  }

  // If record has an id update it, else create it
  if (this._activeRecord.id) {
    result = this._table.update(this._activeRecord);
  } else {
    result = this._table.createRecords(this._activeRecord);
  }

  // Simplified version (Not Working)
  // _saveRecords would have to return a validly formatted result
  // const result = this._table.saveRecords(this._activeRecord);

  // If Airtable responds with a valid record
  // Set _activeRecord to the id and add
  if (result?.records[0]?.id) {
    this._activeRecord._id = result.records[0].id;
    this._saveRecentRecord();
  }
  return result;
}

// Creates a file that tracks recently used records
function saveRecentRecordV1() {
  // Connect to iCloud storage
  const fmCloud = FileManager.createCloud();
  // Search _recentRecords for _activeRecord.id
  const index = this._recentRecords.findIndex((record) => record.id == this._activeRecord.id) >= 0;
  if (index) {
    // If record is in _recentRecords move it to the 0 position
    this._recentRecords[index] = {
      id: this._activeRecord.id,
      Title: this._activeRecord.Title,
    };
    this._recentRecords.unshift(this._recentRecords.splice(index, 1)[0]);
  } else {
    // If record is NOT _recentRecords add it in the 0 position
    this._recentRecords.unshift({
      id: this._activeRecord.id,
      Title: this._activeRecord.Title,
    });
  }
  // Trim _recentRecords to contain no more than 5 records
  this._recentRecords.forEach((record, index) => {
    if (!record?.Title) {
      const title = this._retrieveRecordById(record.id).Title;
      if (!title) return (this._recentRecords[index] = null);
      record.Title = title;
    }
  });
  this._recentRecords.filter(Boolean);
  if (this._recentRecords.length > 5) this._recentRecords.splice(-1);

  // Save _recentRecords to file system
  const sucess = fmCloud.writeJSON(this.filesPath + this._settings.recentRecordsFile, this._recentRecords);
  if (!sucess) this._displayErrorMessage("Recent Records could not be saved!");
}

function saveRecentRecordV2() {
  // Connect to iCloud storage
  const fmCloud = FileManager.createCloud();
  const records = this._retrieveRecentRecords();

  // Creates an object for each table with the format { Title: id }
  let recentRecords = this._parseJSONFromiCloudFile(this._settings.recentRecordsFile);
  recentRecords[this.tableName] = records.reduce(
    (obj, record) => ({
      ...obj,
      [record._fields.Title]: { id: record._id, Updated: record._fields.Updated },
    }),
    {}
  );

  // Save recentRecords to file system
  const sucess = fmCloud.writeJSON(this.filesPath + this._settings.recentRecordsFile, recentRecords);
  if (!sucess) this._displayErrorMessage("Recent Records could not be saved!");
}

function saveRecentRecordV3(table = this.tableName) {
  // Connect to iCloud storage
  const fmCloud = FileManager.createCloud();
  const recentRecords = this._parseJSONFromiCloudFile(this._settings.recentRecordsFile);
  let records = this._retrieveRecentRecords(recentRecords, table);

  // If there is an Active Record save it at the top of array
  if (this._activeRecord) {
    const updated = new Date();
    const index = records.findIndex((record) => record.id == this._activeRecord.id);
    if (index >= 0) records.splice(index, 1);
    records.unshift({
      id: this._activeRecord.id,
      fields: {
        Title: this._activeRecord.Title,
        DraftsID: this._activeRecord?.DraftsID,
        UlyssesID: this._activeRecord?.UlyssesID,
        Updated: updated.toISOString(),
      },
    });
  }

  // Truncate records to the first 10
  records.slice(0, 9);

  // Creates an object for each table with the format { Title: id }
  recentRecords[table] = records.map((record) => ({
    id: record.id,
    fields: {
      Title: record.fields.Title,
      DraftsID: record.fields?.DraftsID,
      UlyssesID: record.fields?.UlyssesID,
      Updated: record.fields.Updated,
    },
  }));

  // Save recentRecords to file system
  const sucess = fmCloud.writeJSON(this.filesPath + this._settings.recentRecordsFile, recentRecords);
  if (!sucess) this._displayErrorMessage("Recent Records could not be saved!");
}

const retrieveRecentRecords = () =>
  this._table.fields(["Title", "Updated", "DraftsID", "UlyssesID"]).maxRecords("10").sort("Updated", "desc").select();

function retrieveRecentRecordsV2(recentRecords, table) {
  if (recentRecords[table]) return recentRecords[table];

  return this._table
    .fields(["Title", "Updated", "DraftsID", "UlyssesID"])
    .maxRecords("10")
    .sort("Updated", "desc")
    .select(); // "desc"/"asc"
}

// Updates the Slug of _activeRecord
function updateSlugOfActiveRecord() {
  const targetId = this._activeRecord.UlyssesID;
  if (targetId) {
    // If post is in Ulysses, get the current Sheet title and update record
    const sheet = this._getItemsFromUlysses(targetId);
    this._activeRecord.Title = this._scrubTitle(sheet.title, this._activeRecord.Destination);
  }
  const slug = this._convertTitleToSlug(this._activeRecord.Title);
  this._activeRecord.addField("Slug", slug);
}

function lookupTragetID() {
  if (this._activeRecord.UlyssesID == undefined) {
    const validId = this._addMissingTargetId();
    if (validId == undefined) return undefined;

    // Update Pipeline with a valid Ulysses ID
    this._activeRecord.addField("UlyssesID", validId);
    this._saveActiveRecord();
  }

  return this._activeRecord.UlyssesID;
}

// ********************
// ** Drafts Functions
// ********************

// Checks if Drafts has a tag from the locations Object
// and returns the corresponding Ulysses GroupID
function returnDestinationOfDraft(workingDraft) {
  for (const [key, value] of Object.entries(this._destinations)) {
    if (workingDraft.hasTag(key)) {
      return key;
    }
  }
  return "Inbox";
}

// Checks Drafts to see if it has a tag associated with a Pipeline destination
// If so it returns the destination name
function returnDestinationOfDraftV2(workingDraft) {
  // Loops through destinations keys and checks if Draft has a key as tag
  const currentDestination = Object.keys(this._destinations)
    .filter((destination) => workingDraft.hasTag(destination))
    .toString();

  // Returns the currentDestination or prompts to select destination
  return currentDestination ? currentDestination : this._selectDestination();
}

// Checks Drafts to see if it has a tag associated with a Pipeline status
// If so it returns the status name
function returnStatusOfDraft(workingDraft) {
  const { statusList } = this._settings;
  // Loops through Status list and checks if Draft has a status as tag
  const currentStatus = statusList.filter((status) => workingDraft.hasTag(status)).toString();

  // Returns the currentStatus or prompts to select status
  return currentStatus ? currentStatus : this._selectStatus();
}

// Updates the status of a draft by adding and removing tags
function updateStatusOfDraft(uuid, newStatus) {
  if (!uuid) return;
  const { statusList } = this._settings;

  let workingDraft = Draft.find(uuid);
  const currentStatus = statusList.filter((status) => workingDraft.hasTag(status)).toString();

  workingDraft.removeTag(currentStatus);
  workingDraft.addTag(newStatus);
  workingDraft.update();
}

function loadDraft(workingDraft) {
  const workspace = Workspace.find("default");
  app.applyWorkspace(workspace);
  editor.load(workingDraft);
  editor.activate();
}

function updateDraftWithTag(workingDraft, tag) {
  workingDraft.addTag(tag);
  workingDraft.update();
}

function lookupActionBy(destination) {
  return Action.find(this._destinations[destination].draftAction);
}

// ********************
// ** Ulysses Functions
// ********************

// Checks Sheet to see if it has a tag associated with a Pipeline status
// If so it returns the status name
function returnStatusOfSheet(sheet) {
  const { statusList } = this._settings;
  // Loops through Status list and checks if Draft has a status as tag
  const currentStatus = statusList.filter((status) => sheet.keywords.includes(status)).toString();

  // Returns the currentStatus or prompts to select status
  return currentStatus ? currentStatus : this._selectStatus();
}

// Checks Sheet to see if it has a tag associated with a Pipeline destination
// If so it returns the destination name
function returnDestinationOfSheet(sheet) {
  // Loops through destinations keys and checks if Draft has a key as tag
  const currentDestination = Object.keys(this._destinations)
    .filter((destination) => sheet.keywords.map((k) => k.toLowerCase()).includes(destination))
    .toString();

  // Returns the currentDestination or prompts to select destination
  return currentDestination ? currentDestination : this._selectDestination();
}

// Updates the status of a sheet by adding and removing keywords
function updateStatusOfSheet(targetId, newStatus) {
  if (!targetId) return;

  // Debug this
  const sheet = this._retrieveSheetById(targetId);
  const currentStatus = this._returnStatusOfSheet(sheet);
  if (currentStatus == newStatus) return;

  this._ulysses.removeKeywords(targetId, currentStatus);
  this._sleep(1000);
  return this._ulysses.attachKeywords(targetId, newStatus);
}

function createSheetInUlyssesWith(workingDraft) {
  // Process Draft
  const destination = this._getDestinationFromDraft(workingDraft);
  const groupID = this._destinations[destination].groupID;
  const content = this._ulysses.convertMarkdown(workingDraft.content);
  const keywords = this._ulysses.capitalizeTags(workingDraft.tags);

  // Create new sheet and attach keywords + note
  const newSheet = this._ulysses.newSheet(content, groupID);
  this._ulysses.attachKeywords(newSheet.targetId, keywords);
  this._attachDefaultNotes(newSheet.targetId);
}

function getItemsFromUlyssesV1(targetId) {
  const emptySet = { sheets: {} };
  if (targetId == null || this._typeCheckString(targetId, "getItemsFromUlyssesV1") == false) return emptySet;

  const items = this._ulysses.getItem(targetId);
  return items?.errorCode ? emptySet : items;
}

function retrieveSheetById(targetId) {
  return this._ulysses.readSheet(targetId);
}

function attachDefaultNotes(targetId) {
  if (!this._typeCheckString(targetId, "attachDefaultNotes")) return false;

  const { excerptText, cbData: darftsCallbackData, markdownLinks } = this._settings;
  this._ulysses.attachNote(targetId, excerptText);

  // markdownLinks.links.forEach((link) => this._ulysses.attachNote(cbData.baseURL + cbData.runActionParams );
  this._ulysses.attachNote(
    targetId,
    `[Content Pipeline: Update Status](drafts://x-callback-url/runAction?action=updateStatusWithUlyssesID&text=${targetId})`
  );
}

// ********************
// ** AirTable Functions
// ********************

function retrieveRecordById(recordId) {
  if (this._buttons) this._table.pageSize("5");
  return this._table.findById(recordId);
}

function retrieveRecordByField(field, value) {
  this._table.fields(this._settings.defaultFields);
  if (this._buttons) this._table.pageSize("5");
  return this._table.findFirstByField(field, value);
}

function retrieveRecordsByField(field, value) {
  this._table.fields(this._settings.defaultFields);
  if (this._buttons) this._table.pageSize("5");
  return this._table.findByField(field, value);
}

function lookUpAirTableFieldName(destination) {
  if (!this._destinations[destination])
    return this._displayErrorMessage("_lookUpAirTableFieldName: Destination not found!");
  return this._destinations[destination].airtableName;
}

function createRecordWith(fields) {
  // let record = this._table.newRecord();
  // Object.entries(fields).forEach(([field, value]) => record.addField(field, value));
  return ATRecord.create({ id: null, fields: fields });
}

function updateRecordWith(record, fields) {
  return record;
}
