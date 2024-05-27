function buildMenu(title, message, buttons, picker = false, textField = false) {
  // Create and return a prompt
  let prompt = Prompt.create();
  prompt.title = title;
  prompt.message = message;
  if (picker) prompt.addPicker(picker.name, picker.label, picker.columns);
  if (textField) prompt.addTextField(textField.name, textField.label, textField.initialText);
  buttons.forEach((button) => prompt.addButton(button.name, button.value, button?.isDefault));
  return prompt;
}

// Version 3 of the buildMenu function
// Builds and returns a prompt based on the menuSettings object
function buildMenuV3(menuSettings) {
  // Create and return a prompt
  let prompt = Prompt.create();
  prompt.title = menuSettings.menuTitle;
  prompt.message = menuSettings.menuMessage;
  for (const menuItem of menuSettings.menuItems) {
    const {
      name,
      value,
      label,
      isDefault = false,
      allowMultiple = false,
      options = {},
      values = [],
      selectedValues = [],
      columns = [[]],
      initialText = "",
      initialDate = new Date(),
      initialValue = "",
    } = menuItem.data;
    switch (menuItem.type) {
      case "button":
        prompt.addButton(name, value, isDefault);
        break;
      case "datePicker":
        prompt.addDatePicker(name, label, initialDate, options);
        break;
      case "label":
        prompt.addLabel(name, label, options);
        break;
      case "password":
        prompt.addPasswordField(name, label, initialValue);
        break;
      case "picker":
        prompt.addPicker(name, label, columns);
        break;
      case "select":
        prompt.addSelect(name, label, values, selectedValues, allowMultiple);
        break;
      case "switch":
        prompt.addSwitch(name, label, initialValue);
        break;
      case "textField":
        prompt.addTextField(name, label, initialText, options);
        break;
      case "textView":
        prompt.addTextView(name, label, initialText, options);
        break;
    }
  }
  return prompt;
}

function createPickerFromRecordsV1(records) {
  return [
    records
      .map((record) => {
        const airTableRecord = this._retrieveRecordById(record.id);
        if (!airTableRecord) return null;
        if (!record.Title) record.Title = airTableRecord.Title;
        return record.Title;
      })
      .filter(Boolean),
  ];
}

// If not, a prompt is displayed for choosing one.
function selectStatus() {
  const {
    statusList,
    _selectStatus: { menuSettings, errorMessage },
  } = this._settings;
  let choseStatus = Prompt.create();
  choseStatus.title = menuSettings.menuTitle;
  choseStatus.message = menuSettings.menuMessage;
  choseStatus.isCancellable = false;
  statusList.forEach((status) => choseStatus.addButton(this._titleCase(status), status));

  // Displays prompt and returns chosen status
  if (!choseStatus.show()) return this._displayErrorMessage(errorMessage);

  return choseStatus.buttonPressed;
}

// If not, a prompt is displayed for choosing one.
// TO-do: Add way of adding a new destination
function selectDestination() {
  const {
    _selectDestination: { menuSettings, errorMessage },
  } = this._settings;
  let choseDestination = Prompt.create();
  choseDestination.title = menuSettings.menuTitle;
  choseDestination.message = menuSettings.menuMessage;
  choseDestination.isCancellable = false;

  Object.keys(this._destinations).forEach((destination) =>
    choseDestination.addButton(this._titleCase(destination), destination)
  );

  // Displays prompt and returns chosen Destination
  if (!choseDestination.show()) return this._displayErrorMessage(errorMessage);
  return choseDestination.buttonPressed;
}

// Prompts to add a UlyssesID when it is missing from a record
function addMissingTargetId() {
  const {
    _addMissingTargetId: { infoMessage, menuSettings, menuPicker },
  } = this._settings;
  app.displayInfoMessage(infoMessage);

  // Get All items in group from Ulysses
  const destinationKey = this._activeRecord.Destination.toLowerCase();

  // This will throw an error if no groupID is found
  const { groupID } = this._lookUpDestinationID(destinationKey);
  const { sheets } = this._getItemsFromUlysses(groupID);
  const foundSheets = Object.entries(sheets).length > 0;

  if (foundSheets) {
    // Construct prompt
    const pickerItems = sheets.map((sheet) => sheet.title);
    menuSettings.menuItems.unshift({ type: "picker", data: menuPicker });
    menuPicker["columns"] = [pickerItems];
  }

  menuSettings.menuMessage = menuSettings.menuMessage.concat(this._activeRecord.Title);
  const addId = this._buildMenu(menuSettings);

  let validSheet;
  do {
    // Display prompt and save targetID to Pipeline
    if (!addId.show()) return context.cancel();
    const indexValue = addId.fieldValues["sheetIndex"];
    const textFieldValue = addId.fieldValues["targetID"];
    const targetId = foundSheets ? sheets[indexValue].identifier : textFieldValue;

    validSheet = this._ulysses.readSheet(targetId);
  } while (validSheet["errorCode"] == 1);

  return validSheet.identifier;
}

function createPickerFromRecordsV2(records) {
  // { "Title": { "id: "xxxx", "Updated": "date" }
  if (!records) {
    this._saveRecentRecordV2();
    records = this._parseJSONFromiCloudFile(this._settings.recentRecordsFile)[this.tableName];
  }
  const sorted = Object.entries(records).sort(([, a], [, b]) => new Date(b.Updated) - new Date(a.Updated));
  return [sorted.map((item) => item[0])];
}

function createPickerFromRecordsV3(records, table = this.tableName) {
  // [{ id: "xxxx", title: "xxx", Updated": "date" }]
  if (!records) {
    this._saveRecentRecord();
    records = this._parseJSONFromiCloudFile(this._settings.recentRecordsFile)[table];
  }

  return [records.map((record) => record.fields.Title)];
}

function getRecordIdFromPromptPicker(prompt, menuPicker) {
  const index = prompt.fieldValues[menuPicker.name][0];
  const title = menuPicker.columns[0][index];
  return this._recentRecords[title].id;
}

function getRecordIdFromPromptPickerV3(prompt, menuPicker) {
  const index = prompt.fieldValues[menuPicker.name][0];
  return this._recentRecords[index].id;
}

function getRecordFromPromptPickerV3(prompt, menuPicker) {
  const index = prompt.fieldValues[menuPicker.name][0];
  return this._recentRecords[index];
}

// Displays a Yes/No prompt if Draft should be added to Pipeline
function addDraftToPipelinePrompt(workingDraft) {
  const {
    _addDraftToPipelinePrompt: { infoMessage, menuSettings },
  } = this._settings;
  let addNow = this._buildMenu(menuSettings);
  addNow.isCancellable = false;
  addNow.show();
  if (addNow != menuSettings.menuItems[0].data.value) return this._displayInfoMessage(infoMessage);
  return this.addDraftToPipeline(workingDraft);
}

// Displays a Yes/No prompt if Draft should be added to Pipeline
function addDraftToUlyssesPrompt(workingDraft) {
  const {
    _addDraftToUlyssesPrompt: { infoMessage, menuSettings },
  } = this._settings;
  let addNow = this._buildMenu(menuSettings);
  addNow.isCancellable = false;
  addNow.show();
  if (addNow != menuSettings.menuItems[0].data.value) return this._displayInfoMessage(infoMessage);
  return this.sendDraftToUlysses(workingDraft);
}

function returnAvailableStatuses(statusList, activeStatus) {
  // Generates a options to select a new status
  const index = statusList.findIndex((status) => status == activeStatus);
  // statusList.splice(0, index + 1);
  return statusList
    .slice(index + 1, statusList.length)
    .reduce(
      (obj, status) => [...obj, { type: "button", data: { name: status, value: status } }],
      [{ type: "button", data: { name: "<< Back", value: "back", isDefault: true } }]
    );
}

function statusIsNotLast(status) {
  const { statusList } = this._settings;
  return status != statusList[statusList.length - 1];
}

const getTextFieldValueFromMenu = (menu) => menu.fieldValues[Object.keys(menu.fieldValues)[0]];
const optionsWithBackButton = (options, backCommand) => [...options, ...{ "<< Back": backCommand }];
