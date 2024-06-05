require("cp/documents/ulysses_document.js");
require("cp/documents/drafts_document.js");
require("cp/documents/test_document.js");

class DocumentFactory {
  #ui;
  #settings;
  #docDependancies;

  constructor(dependancies) {
    this.#ui = dependancies.ui;
    this.#settings = dependancies.settings.documentFactory;

    this.#docDependancies = {
      ui: dependancies.ui,
      destinations: dependancies.destinations,
      statuses: dependancies.statuses,
      tableName: dependancies.tableName,
      textUltilities: dependancies.textUltilities,
      defaultTag: dependancies.defaultTag,
    };
  }

  load(record) {
    // const docIDType = record;
    if (record.docIDType == undefined)
      return this.#ui.displayErrorMessage({
        errorMessage: "Record is missing docIDType!!",
        class: "DocumentFactory",
        function: "load()",
        record: record,
        docIDType: record.docIDType,
      });
    if (record?.docID == undefined) record.docID = this.#promptForDocID(record.docIDType);

    let doc = undefined;
    switch (record.docIDType) {
      case "DraftsID":
        this.#docDependancies["settings"] = this.#settings.draftsDoc;
        doc = new DraftsDoc(this.#docDependancies, record);
        break;
      case "UlyssesID":
        this.#docDependancies["settings"] = this.#settings.ulyssesDoc;
        doc = new UlyssesDoc(this.#docDependancies, record);
        break;
      case "BearID":
        doc = new TestDoc(record);
        break;
      case "TestID":
        doc = new TestDoc(record);
    }

    if (doc == undefined || doc == false)
      return this.#ui.displayErrorMessage({
        errorMessage: "Document could not be loaded!",
        class: "DocumentFactory",
        function: "load()",
        record: record,
        docIDType: record?.docIDType,
        doc: doc,
      });

    return doc;
  }

  create(type) {
    switch (type.toLowerCase()) {
      case "draft":
        this.#docDependancies["settings"] = this.#settings.draftsDoc;
        return new DraftsDoc(this.#docDependancies);
        break;
      case "sheet":
        this.#docDependancies["settings"] = this.#settings.ulyssesDoc;
        return new UlyssesDoc(this.#docDependancies);
        break;
      case "note":
        return new TestDoc(record);
        break;
      default:
        return this.#ui.displayErrorMessage({
          errorMessage: `Could not create doc with type: ${type}`,
          class: "DocumentFactory",
          function: "create()",
          type: type,
        });
    }
  }

  #promptForDocID(docIDType) {
    const { menuSettings } = this.#settings.promptForDocID;

    menuSettings.menuTitle = `${menuSettings.menuTitle} ${docIDType}`;
    menuSettings.menuItems.forEach((item) => {
      if (item.type == "textField") {
        item.data["label"] = docIDType;
        item.data["initialText"] = app.getClipboard();
      }
    });

    // Build and display the menu prompt
    // Exit if cancel has been pressed
    const menu = this.#ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    return this.#ui.utilities.getTextFieldValueFromMenu(menu);
  }

  #checkForDocIDType(record) {
    if (record.docIDType != undefined) return record.docIDType;
    if (record.fields?.DraftsID != undefined) return "DraftsID";
    if (record.fields?.UlyssesID != undefined) return "UlyssesID";

    return undefined;
  }
}
