require("cp/documents/ulysses_document.js");
require("cp/documents/drafts_document.js");
require("cp/documents/test_document.js");

class DocumentFactory {
  #ui;
  #settings;
  #docdependencies;

  constructor(dependencies) {
    this.#ui = dependencies.ui;
    this.#settings = dependencies.settings.documentFactory;

    this.#docdependencies = {
      ui: dependencies.ui,
      destinations: dependencies.destinations,
      statuses: dependencies.statuses,
      tableName: dependencies.tableName,
      textUltilities: dependencies.textUltilities,
      defaultTag: dependencies.defaultTag,
    };
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
        this.#docdependencies["settings"] = this.#settings.draftsDoc;
        doc = new DraftsDoc(this.#docdependencies, record);
        break;
      case "UlyssesID":
        this.#docdependencies["settings"] = this.#settings.ulyssesDoc;
        doc = new UlyssesDoc(this.#docdependencies, record);
        break;
      case "BearID":
        doc = new TestDoc(record);
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
        this.#docdependencies["settings"] = this.#settings.draftsDoc;
        return new DraftsDoc(this.#docdependencies);
        break;
      case "sheet":
        this.#docdependencies["settings"] = this.#settings.ulyssesDoc;
        return new UlyssesDoc(this.#docdependencies);
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
