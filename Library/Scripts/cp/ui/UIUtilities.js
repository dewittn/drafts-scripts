class UIUtilities {
  constructor() {}

  createPickerFromRecords(records) {
    if (records == undefined) return [[]];
    // [{ id: "xxxx", title: "xxx", Updated": "date" }]
    return [records.filter((record) => record != null).map((record) => record.fields.Title)];
  }

  getRecordFromPromptPicker(prompt, menuPicker, records) {
    const index = prompt.fieldValues[menuPicker.name][0];
    return records[index];
  }

  getIndexFromPromptPicker(prompt, menuPicker) {
    return prompt.fieldValues[menuPicker.name][0];
  }

  addRecordColomsToMenuPicker(menuPicker, menuSettings, records) {
    if (menuPicker["columns"] != undefined) return;

    menuPicker["columns"] = this.createPickerFromRecords(records);
    menuSettings.menuItems.push({ type: "picker", data: menuPicker });
  }

  getTextFieldValueFromMenu(menu) {
    return menu.fieldValues[Object.keys(menu.fieldValues)[0]];
  }

  getFieldValuesFromPrompt(menu, field) {
    return menu.fieldValues[field];
  }
}
