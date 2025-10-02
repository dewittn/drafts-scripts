require("modules/cp/documents/UlyssesDocument.js");
require("modules/cp/documents/DraftsDocument.js");
require("modules/cp/documents/BearDocument.js");
require("modules/cp/documents/TestDocument.js");

class DocumentFactory {
  #ui;
  #settings;
  #dependencyProvider;

  constructor(dependencyProvider) {
    this.#dependencyProvider = dependencyProvider;
    this.#ui = dependencyProvider.ui;
    this.#settings = dependencyProvider.settings.documentFactory;
  }

  load(record) {
    const errorMessage = "Record is missing docIDType!!";
    const errorMessage2 = "Document could not be loaded!";
    // const docIDType = record;
    if (record.docIDType == undefined) {
      return this.#ui.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "DocumentFactory",
        function: "load()",
        record: record,
        docIDType: record.docIDType,
      });
    }
    if (record?.docID == undefined) {
      record.docID = this.#promptForDocID(record.docIDType);
    }

    let doc = undefined;
    switch (record.docIDType) {
      case "DraftsID":
        doc = new DraftsDoc(this.#dependencyProvider, this.#settings.draftsDoc, record);
        break;
      case "UlyssesID":
        doc = new UlyssesDoc(this.#dependencyProvider, this.#settings.ulyssesDoc, record);
        break;
      case "BearID":
        doc = new BearDoc(this.#dependencyProvider, this.#settings.bearDoc, record);
        break;
      case "TestID":
        doc = new TestDoc(record);
    }

    if (doc == undefined || doc == false) {
      return this.#ui.displayAppMessage("error", errorMessage2, {
        errorMessage: errorMessage2,
        class: "DocumentFactory",
        function: "load()",
        record: record,
        docIDType: record?.docIDType,
        doc: doc,
      });
    }

    return doc;
  }

  create(type) {
    switch (type.toLowerCase()) {
      case "draft":
        return new DraftsDoc(this.#dependencyProvider, this.#settings.draftsDoc);
        break;
      case "sheet":
        return new UlyssesDoc(this.#dependencyProvider, this.#settings.ulyssesDoc);
        break;
      case "note":
        return new BearDoc(this.#dependencyProvider, this.#settings.bearDoc);
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
    if (record.fields?.BearID != undefined) return "BearID";

    return undefined;
  }
}
