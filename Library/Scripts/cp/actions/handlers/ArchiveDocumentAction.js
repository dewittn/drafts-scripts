// ArchiveDocumentAction.js
// Action handler for archiving documents

class ArchiveDocumentAction {
  #fs;

  constructor(dependancies) {
    this.#fs = dependancies.fileSystem;
  }

  async execute(doc, params, context) {
    const { location } = params;

    if (!location) {
      throw new Error("location parameter is required for archive_document action");
    }

    // Move document to archive location (implementation depends on doc type)
    // For Drafts documents, we can move to archive
    if (doc.archive && typeof doc.archive === "function") {
      doc.archive();
    } else if (doc.moveTo && typeof doc.moveTo === "function") {
      doc.moveTo(location);
    } else {
      console.warn(
        `Document type ${doc.docIDType} does not support archiving, skipping`
      );
    }

    return {
      success: true,
      archivedLocation: location,
      docID: doc.docID,
      docIDType: doc.docIDType,
    };
  }
}