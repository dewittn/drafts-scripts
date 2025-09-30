// ConvertDocumentAction.js
// Action handler for converting documents between types

class ConvertDocumentAction {
  #documentFactory;

  constructor(dependancies) {
    this.#documentFactory = dependancies.documentFactory;
  }

  async execute(doc, params, context) {
    const { targetType } = params;

    if (!targetType) {
      throw new Error("targetType parameter is required for convert_document action");
    }

    // Create new document
    const newDoc = this.#documentFactory.create(targetType);
    if (!newDoc) {
      throw new Error(`Could not create document of type: ${targetType}`);
    }

    // Copy properties from old document to new document
    newDoc.status = doc.status;
    newDoc.destination = doc.destination;
    newDoc.content = doc.content;
    if (doc.record) {
      newDoc.record = doc.record;
    }

    // Save new document
    if (!newDoc.save()) {
      throw new Error(`Could not save ${targetType} document`);
    }

    // Store reference to new doc in context for potential use by subsequent actions
    context.convertedDoc = newDoc;

    return {
      success: true,
      newDocID: newDoc.docID,
      newDocIDType: newDoc.docIDType,
      oldDocID: doc.docID,
      oldDocIDType: doc.docIDType,
    };
  }
}