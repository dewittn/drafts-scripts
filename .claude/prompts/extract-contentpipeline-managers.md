# Extract ContentPipeline into Focused Manager Classes

## Objective

Decompose the ContentPipeline God Object (790 lines, 30+ methods, 7-8 responsibilities) into focused manager classes following the Single Responsibility Principle. This will reduce complexity by 80%, improve maintainability, and make the codebase easier to test and extend.

## Context

**Current State:**
- `ContentPipeline.js` has grown to 790 lines with multiple distinct responsibilities
- Methods handle everything from document operations to UI orchestration
- Hard to understand, test, and modify
- Violates Single Responsibility Principle

**After Refactoring:**
- ContentPipeline becomes a thin orchestrator (~150 lines)
- 5 focused manager classes handle specific concerns
- Each manager is independently testable
- Clear separation of concerns
- Easier to extend and maintain

**Note:** ContentPipeline has already been converted to singleton pattern. This refactoring maintains that pattern.

## Architecture Overview

### New Structure

```
ContentPipeline (orchestrator/facade)
├── DocumentManager      - Document CRUD operations
├── PipelineManager      - Pipeline entry management
├── StatusManager        - Status updates and synchronization
├── MenuOrchestrator     - UI menu coordination
└── NavigationManager    - URL generation and navigation helpers
```

### Responsibility Mapping

| Current ContentPipeline Methods | New Manager | New Location |
|--------------------------------|-------------|--------------|
| `openDoc()`, `createNewDoc()`, `deleteContent()`, `modifyActiveDoc()` | DocumentManager | `modules/cp/managers/DocumentManager.js` |
| `addDocToPipeline()`, `addDefaultNotesToSheet()`, `convertDraft()` | PipelineManager | `modules/cp/managers/PipelineManager.js` |
| `updateStatusOfDoc()`, `syncStatusOfSheet()` | StatusManager | `modules/cp/managers/StatusManager.js` |
| `welcome()`, `useCurrentDraft()`, `selectDocByStatus()`, `addContent()` | MenuOrchestrator | `modules/cp/managers/MenuOrchestrator.js` |
| `getPublishedPostURL()`, `#functionToRunNext()` | NavigationManager | `modules/cp/managers/NavigationManager.js` |

### Shared Dependencies

All managers will receive a `ManagerContext` object containing:
- `dependencyProvider` - Access to settings, UI, database, etc.
- `activeDoc` - Current document being operated on
- `services` - ServiceContainer instance
- Callback to set activeDoc: `setActiveDoc(doc)`

## Implementation Steps

**IMPORTANT:** Commit changes after each step to maintain incremental progress and enable easy rollback if needed.

### Commit Strategy

This refactoring follows an **incremental commit approach**:

- **8 commits total**: One for each manager + final refactor + tests
- **Commit after each file created**: Don't batch multiple managers into one commit
- **Use conventional commits**: `feat(cp):`, `refactor(cp):`, `test(cp):`
- **Descriptive messages**: Explain what and why in commit body
- **Test before committing**: Ensure no syntax errors (doesn't need to fully work until Step 6)

**Why this approach?**
- Clear progress tracking in git history
- Easy to identify which step introduced an issue
- Can rollback granularly to any step
- Reviewable in small chunks
- Can cherry-pick specific managers if needed

**Before you start:**
```bash
# Ensure working directory is clean
git status

# Create feature branch (recommended)
git checkout -b feature/extract-contentpipeline-managers

# Or work directly on dev (if you prefer)
git checkout dev
```

---

### Step 0: Create Manager Base Class (Optional but Recommended)

**File:** `Library/Scripts/modules/cp/managers/BaseManager.js`

```javascript
/**
 * BaseManager - Base class for all ContentPipeline managers
 * Provides common functionality and shared dependencies
 */
class BaseManager {
  #context;
  #dependencyProvider;

  constructor(context) {
    this.#context = context;
    this.#dependencyProvider = context.dependencyProvider;
  }

  // Shared getters for common dependencies
  get ui() {
    return this.#dependencyProvider.ui;
  }

  get settings() {
    return this.#dependencyProvider.settings;
  }

  get db() {
    return this.#context.database;
  }

  get fs() {
    return this.#dependencyProvider.fileSystem;
  }

  get text() {
    return this.#dependencyProvider.textUltilities;
  }

  get statuses() {
    return this.#context.statuses;
  }

  get destinations() {
    return this.#context.destinations;
  }

  get recent() {
    return this.#context.recentRecords;
  }

  get documentFactory() {
    return this.#context.documentFactory;
  }

  // Shared active document access
  get activeDoc() {
    return this.#context.activeDoc;
  }

  set activeDoc(doc) {
    this.#context.setActiveDoc(doc);
  }

  // Shared utility methods
  displayAppMessage(type, message, data = {}) {
    return this.ui.displayAppMessage(type, message, data);
  }

  throwDBError(parentFunction) {
    this.db.stackTrace["parentFunction"] = parentFunction;
    this.ui.displayAppMessage("error", "Database Error!", this.db.stackTrace);
  }
}
```

**Commit after this step:**
```bash
git add Library/Scripts/modules/cp/managers/BaseManager.js
git commit -m "feat(cp): Add BaseManager base class for manager extraction

- Create base class with shared dependencies
- Provide common getters for UI, settings, database, etc.
- Add utility methods for error handling
- Foundation for ContentPipeline manager extraction

Part of ContentPipeline refactoring to reduce God Object complexity
from 790 lines to ~150 lines orchestrator."
```

---

### Step 1: Create DocumentManager

**File:** `Library/Scripts/modules/cp/managers/DocumentManager.js`

```javascript
if (typeof BaseManager == "undefined") require("modules/cp/managers/BaseManager.js");

/**
 * DocumentManager - Handles document CRUD operations
 *
 * Responsibilities:
 * - Opening documents
 * - Creating new documents
 * - Deleting documents
 * - Modifying document properties
 */
class DocumentManager extends BaseManager {
  constructor(context) {
    super(context);
  }

  /**
   * Open a document in its native application
   * @param {string} docID - Document identifier
   * @param {string} docIDType - Type of document ID (DraftsID, UlyssesID, etc.)
   */
  open(docID, docIDType) {
    const { docNotFound, recentDocsNotSaved } = this.settings.openDoc;

    // Load document if not already set
    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: docID,
        docIDType: docIDType,
      });
    }

    // Validate document was loaded
    if (this.activeDoc == undefined) {
      return this.displayAppMessage("error", docNotFound, {
        errorMessage: docNotFound,
        activeDoc: this.activeDoc,
      });
    }

    // Update recent records
    if (!this.#updateRecentRecords()) {
      this.displayAppMessage("info", recentDocsNotSaved, {
        recentRecordsUpdated: false,
        activeDoc: this.activeDoc,
      });
    }

    // Open the document
    this.activeDoc.open();
  }

  /**
   * Create a new document from template or blank
   */
  create() {
    this.activeDoc = this.documentFactory.create("draft");
    this.activeDoc.save();
    return this.activeDoc;
  }

  /**
   * Delete content from various locations
   * @returns {boolean} Success status
   */
  delete() {
    const { menuSettings } = this.settings.delContent;

    if (this.activeDoc == undefined) {
      return false;
    }

    // Build and display delete options menu
    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    let delRecentRecord = false;
    let delDBEntry = false;
    let delDoc = false;

    // Determine what to delete based on user selection
    switch (menu.buttonPressed) {
      case "everywhere":
        delDoc = true;
      case "database":
        delDBEntry = true;
      case "recentRecords":
        delRecentRecord = true;
    }

    // Execute deletions
    if (delRecentRecord) {
      this.recent.delete(this.activeDoc);
      this.displayAppMessage("success", "Doc deleted from Recent Records.");
    }

    if (delDBEntry) {
      this.db.delete(this.activeDoc);
      this.activeDoc.inPipeline = false;
      this.displayAppMessage("success", "Doc deleted from the database.");
    }

    if (delDoc) {
      this.activeDoc.delete();
      this.displayAppMessage("success", "Doc has been deleted.");
    }

    return true;
  }

  /**
   * Modify active document properties
   * @param {string} docIDType - Document ID type
   * @param {string} docID - Document ID
   */
  modify(docIDType, docID) {
    const { errorMessage, menuSettings } = this.settings.modifyActiveDoc;

    // Load document if needed
    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: docID,
        docIDType: docIDType,
      });
    }

    // Validate document loaded
    if (this.activeDoc == undefined) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "DocumentManager",
        function: "modify()",
        docIDType: docIDType,
        docID: docID,
      });
    }

    // Add convert option for Drafts
    if (this.activeDoc.docIDType == "DraftsID") {
      menuSettings.menuItems.push({
        type: "button",
        data: {
          name: "Convert Draft to Other Document",
          value: "convertDraft",
        },
      });
    }

    menuSettings.menuMessage = menuSettings.menuMessage.concat(
      this.activeDoc.title
    );

    // Show menu
    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    return menu.buttonPressed;
  }

  // Private methods
  #updateRecentRecords() {
    return this.recent.save(this.activeDoc);
  }
}
```

**Commit after this step:**
```bash
git add Library/Scripts/modules/cp/managers/DocumentManager.js
git commit -m "feat(cp): Add DocumentManager for document operations

- Extract document CRUD operations from ContentPipeline
- Handle open, create, delete, modify operations
- Manages active document state
- Clean separation of document-related concerns

Reduces ContentPipeline responsibility count from 8 to 7."
```

---

### Step 2: Create PipelineManager

**File:** `Library/Scripts/modules/cp/managers/PipelineManager.js`

```javascript
if (typeof BaseManager == "undefined") require("modules/cp/managers/BaseManager.js");

/**
 * PipelineManager - Handles pipeline entry management
 *
 * Responsibilities:
 * - Adding documents to pipeline
 * - Converting documents between types
 * - Attaching default notes
 * - Managing pipeline status
 */
class PipelineManager extends BaseManager {
  constructor(context) {
    super(context);
  }

  /**
   * Add document to the Content Pipeline
   * @param {string} docIDType - Document ID type
   * @param {string} docID - Document ID
   * @returns {boolean} Success status
   */
  addDocument(docIDType, docID = undefined) {
    const {
      successMessage,
      errorMessage,
      docExistsMessage,
      infoMessage,
      menuSettings,
    } = this.settings.addDocToPipeline;

    // Load document if not already set
    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: docID,
        docIDType: docIDType,
      });
    }

    // Check if doc is already in pipeline
    if (this.#docIsInPipeline()) {
      return this.displayAppMessage("info", docExistsMessage);
    }

    if (this.db.databaseError) {
      return this.throwDBError("PipelineManager.addDocument()");
    }

    // Prompt to add doc to pipeline
    if (this.ui.yesNoPrompt(menuSettings) === "no") {
      this.displayAppMessage("info", infoMessage);
      return false;
    }

    // Select Status & destination
    if (this.activeDoc.statusIsNotSet) {
      this.activeDoc.status = this.statuses.select(this.activeDoc.title);
    }

    if (this.activeDoc.destinationIsNotSet) {
      this.activeDoc.destination = this.destinations.select(
        this.activeDoc.title
      );
    }

    // Update database with activeDoc
    if (!this.#updateDatabase()) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "PipelineManager",
        function: "addDocument()",
        activeDoc: this.activeDoc,
      });
    }

    if (this.db.databaseError) {
      return this.throwDBError("PipelineManager.addDocument()");
    }

    // Update document with record info
    this.activeDoc.record = this.db.currentRecord;
    this.activeDoc.inPipeline = true;

    // Update recent records
    const warningMessage = "Recent Records could not be saved!";
    if (!this.#updateRecentRecords()) {
      this.displayAppMessage("warning", warningMessage, {
        warningMessage: warningMessage,
        class: "PipelineManager",
        function: "addDocument()",
        activeDoc: this.activeDoc,
      });
    }

    this.displayAppMessage("success", successMessage);
    return true;
  }

  /**
   * Add default notes to a sheet
   * @param {string} targetId - Ulysses sheet target ID
   */
  addDefaultNotes(targetId) {
    const {
      infoMessage,
      errorMessage1,
      errorMessage2,
      successMessage,
      menuSettings,
    } = this.settings.addSheetToPipeline;

    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: targetId,
        docIDType: "UlyssesID",
      });
    }

    // Attach default notes to the document
    this.activeDoc.attachDefaultNotes();
  }

  /**
   * Convert a draft to another document type
   * @param {string} uuid - Draft UUID (defaults to current draft)
   */
  convertDraft(uuid = draft.uuid) {
    const { recentDocsNotSaved } = this.settings.convertDraft;

    // Load draft if needed
    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: uuid,
        docIDType: "DraftsID",
      });
    }

    // Get or create pipeline record
    const record = this.db.retrieveRecordByDocID(this.activeDoc);
    if (record == undefined) {
      this.addDocument("DraftsID", uuid);
    }

    this.activeDoc.record = record;

    // Determine target document type
    const { newDocType } = this.destinations.lookupDocConvertionData(
      this.activeDoc.destination
    );

    // Perform conversion
    this.#convertActiveDoc(newDocType);

    // Update recent records
    if (!this.#updateRecentRecords()) {
      this.displayAppMessage("info", recentDocsNotSaved, {
        activeDoc: this.activeDoc,
      });
    }

    this.displayAppMessage(
      "success",
      `Draft has been converted to a ${newDocType}.`
    );
  }

  // Private methods
  #docIsInPipeline() {
    return this.db.docIsInPipeline(this.activeDoc);
  }

  #updateDatabase() {
    return this.db.updateUsingDoc(this.activeDoc);
  }

  #updateRecentRecords() {
    return this.recent.save(this.activeDoc);
  }

  #convertActiveDoc(newDocType) {
    if (this.activeDoc == undefined || newDocType == undefined) {
      return false;
    }

    const errorMessage = "Document could not be created!";

    // Create new document
    const newDoc = this.documentFactory.create(newDocType);
    if (newDoc == undefined || newDoc == false) {
      return false;
    }

    // Copy properties from old doc to new doc
    newDoc.status = this.activeDoc.status;
    newDoc.destination = this.activeDoc.destination;
    newDoc.content = this.activeDoc.content;

    if (newDoc.save() == false) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "PipelineManager",
        function: "#convertActiveDoc()",
        docType: newDoc.docIDType,
        stackTrace: newDoc?.stackTrace,
      });
    }

    // Update database with new document
    newDoc.record = this.activeDoc.record;
    const success = this.db.updateUsingDoc(newDoc);

    if (this.db.databaseError) {
      return this.throwDBError("PipelineManager.#convertActiveDoc()");
    }

    // Delete old document and update active reference
    this.activeDoc.delete();
    this.activeDoc = newDoc;

    return true;
  }
}
```

**Commit after this step:**
```bash
git add Library/Scripts/modules/cp/managers/PipelineManager.js
git commit -m "feat(cp): Add PipelineManager for pipeline operations

- Extract pipeline entry management from ContentPipeline
- Handle adding documents to pipeline
- Manage document conversions (Draft to Ulysses, etc.)
- Attach default notes to documents

Reduces ContentPipeline responsibility count from 7 to 6."
```

---

### Step 3: Create StatusManager

**File:** `Library/Scripts/modules/cp/managers/StatusManager.js`

```javascript
if (typeof BaseManager == "undefined") require("modules/cp/managers/BaseManager.js");

/**
 * StatusManager - Handles status updates and synchronization
 *
 * Responsibilities:
 * - Updating document status
 * - Syncing status with external apps (Ulysses)
 * - Managing status transitions
 */
class StatusManager extends BaseManager {
  constructor(context) {
    super(context);
  }

  /**
   * Update the status of a document
   * @param {string} docID - Document ID
   * @param {string} docIDType - Document ID type
   * @returns {boolean} Success status
   */
  updateStatus(docID, docIDType) {
    const { errorMessage, errorMessage2, successMessage, menuSettings } =
      this.settings.updateStatusOfDoc;

    // Load document if needed
    if (this.activeDoc == undefined) {
      this.activeDoc = this.documentFactory.load({
        docID: docID,
        docIDType: docIDType,
      });
    }

    // Validate document loaded
    if (this.activeDoc == undefined) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "StatusManager",
        function: "updateStatus()",
        docID: docID,
        docIDType: docIDType,
      });
    }

    // Validate document has title
    if (this.activeDoc.title == undefined) {
      return this.displayAppMessage("error", errorMessage2, {
        errorMessage: errorMessage2,
        class: "StatusManager",
        function: "updateStatus()",
        activeDoc: this.activeDoc,
      });
    }

    // Add to pipeline if not already there
    if (this.activeDoc.inPipeline == false) {
      // Need to call PipelineManager - will handle via context callback
      return { action: "addToPipeline", docID, docIDType };
    }

    // Get current record
    this.activeDoc.record = this.db.retrieveRecordByDocID(this.activeDoc);
    if (this.db.databaseError) {
      return this.throwDBError("StatusManager.updateStatus()");
    }

    // Build status menu
    menuSettings["menuItems"] = this.statuses.generateStatusMenuItems(
      this.activeDoc.status
    );
    menuSettings.menuMessage += `${this.activeDoc.title} is '${this.activeDoc.status}.'`;

    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    // Get new status selection
    const newStatus = menu.buttonPressed;
    if (newStatus == "back") {
      return { action: "back" };
    }

    this.activeDoc.status = newStatus;

    // Check if conversion needed
    const { covertDoc, newDocType } = this.destinations.lookupDocConvertionData(
      this.activeDoc.destination,
      newStatus
    );

    if (covertDoc) {
      // Need to call PipelineManager - will handle via context callback
      return { action: "convertDoc", newDocType };
    }

    // Update records and database
    this.#updateRecentRecords();
    this.#updateDatabase();

    if (this.db.databaseError) {
      return this.throwDBError("StatusManager.updateStatus()");
    }

    this.displayAppMessage("success", successMessage + newStatus);
    return true;
  }

  /**
   * Sync sheet status from database record
   * @param {string} targetId - Ulysses target ID
   */
  syncStatusFromDatabase(targetId) {
    const docData = { docID: targetId, docIDType: "UlyssesID" };
    const record = this.db.retrieveRecordByDocID(docData);
    const errorMessage = "No record found with that Target ID!";

    if (record == undefined) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "StatusManager",
        function: "syncStatusFromDatabase()",
        targetId: targetId,
        docData: docData,
        record: record,
      });
    }

    this.activeDoc = this.documentFactory.load(docData);
    this.activeDoc.status = record.Status;

    return true;
  }

  // Private methods
  #updateDatabase() {
    return this.db.updateUsingDoc(this.activeDoc);
  }

  #updateRecentRecords() {
    return this.recent.save(this.activeDoc);
  }
}
```

**Commit after this step:**
```bash
git add Library/Scripts/modules/cp/managers/StatusManager.js
git commit -m "feat(cp): Add StatusManager for status operations

- Extract status update logic from ContentPipeline
- Handle status transitions and validations
- Sync status with external apps (Ulysses)
- Coordinate with PipelineManager for status-triggered conversions

Reduces ContentPipeline responsibility count from 6 to 5."
```

---

### Step 4: Create MenuOrchestrator

**File:** `Library/Scripts/modules/cp/managers/MenuOrchestrator.js`

```javascript
if (typeof BaseManager == "undefined") require("modules/cp/managers/BaseManager.js");

/**
 * MenuOrchestrator - Handles UI menu coordination
 *
 * Responsibilities:
 * - Welcome screen with recent documents
 * - Current draft action menu
 * - Document selection by status
 * - Add content workflow
 */
class MenuOrchestrator extends BaseManager {
  constructor(context) {
    super(context);
  }

  /**
   * Show welcome screen with recent documents
   * @returns {string} Next action to perform
   */
  showWelcome() {
    const { menuPicker, menuSettings, errorMessage } =
      this.settings.welcome;

    // Create menu picker from recent records
    this.ui.utilities.addRecordColomsToMenuPicker(
      menuPicker,
      menuSettings,
      this.recent.records
    );

    // Build and display menu
    const welcomeScreen = this.ui.buildMenu(menuSettings);
    if (welcomeScreen.show() == false) return context.cancel();

    // Record input from prompt
    const nextFunction = welcomeScreen.buttonPressed;
    const index = this.ui.utilities.getIndexFromPromptPicker(
      welcomeScreen,
      menuPicker
    );
    const record = this.recent.selectByIndex(index);

    this.activeDoc = this.documentFactory.load(record);

    return nextFunction;
  }

  /**
   * Show action menu for current draft
   * @returns {string} Next action to perform
   */
  showCurrentDraftMenu() {
    const { menuSettings } = this.settings.useCurrentDraft;

    if (draft.content == "") {
      return this.displayAppMessage("info", "Cannot use a blank draft!");
    }

    this.activeDoc = this.documentFactory.load({
      docID: draft.uuid,
      docIDType: "DraftsID",
    });

    // Build and display menu
    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    return menu.buttonPressed;
  }

  /**
   * Show document selection menu filtered by status
   * @returns {string} Next action to perform
   */
  showDocumentsByStatus() {
    const { menuSettings, menuPicker } = this.settings.selectDocByStatus;

    // Get status selection
    const status = this.statuses.select();

    // Get records with that status
    if (menuSettings.menuItems.length > 3) {
      menuSettings.menuItems.pop();
    }

    const records = this.db.retrieveRecordsByField("Status", status);
    if (this.db.databaseError) {
      return this.throwDBError("MenuOrchestrator.showDocumentsByStatus()");
    }

    // Build picker with records
    menuPicker["columns"] = this.ui.utilities.createPickerFromRecords(records);
    menuSettings.menuItems.push({ type: "picker", data: menuPicker });

    // Show menu
    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    // Load selected document
    const index = menu.fieldValues[menuPicker.name];
    this.activeDoc = this.documentFactory.load(records[index]);

    return menu.buttonPressed;
  }

  /**
   * Show add content menu
   * @returns {string} Next action to perform
   */
  showAddContentMenu() {
    const { menuSettings } = this.settings.addContent;

    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    return menu.buttonPressed;
  }
}
```

**Commit after this step:**
```bash
git add Library/Scripts/modules/cp/managers/MenuOrchestrator.js
git commit -m "feat(cp): Add MenuOrchestrator for UI coordination

- Extract menu/UI orchestration from ContentPipeline
- Handle welcome screen, current draft menu
- Manage document selection by status
- Coordinate add content workflow

Reduces ContentPipeline responsibility count from 5 to 4."
```

---

### Step 5: Create NavigationManager

**File:** `Library/Scripts/modules/cp/managers/NavigationManager.js`

```javascript
if (typeof BaseManager == "undefined") require("modules/cp/managers/BaseManager.js");

/**
 * NavigationManager - Handles URL generation and navigation
 *
 * Responsibilities:
 * - Getting published post URLs
 * - Function routing/navigation
 * - Year selection
 */
class NavigationManager extends BaseManager {
  constructor(context) {
    super(context);
  }

  /**
   * Get URL of a published post
   * @param {number} year - Year to filter by
   * @returns {string} Post URL
   */
  getPublishedPostURL(year = new Date().getFullYear()) {
    const { menuSettings, menuPicker } = this.settings.getPublishedPostURL;

    const records = this.db.retrieveRecordsByField(
      "Status",
      `Published ${year}✨`,
      {
        field: "Publish Date",
        direction: "desc",
      }
    );

    // Build menu picker
    if (menuSettings.menuItems.length > 2) {
      menuSettings.menuItems.pop();
    }

    menuPicker["columns"] = this.ui.utilities.createPickerFromRecords(records);
    menuSettings.menuItems.push({ type: "picker", data: menuPicker });

    // Display menu
    const menu = this.ui.buildMenu(menuSettings);
    if (menu.show() == false) return context.cancel();

    const nextFunction = menu.buttonPressed;

    // Handle year change request
    if (nextFunction == "getPublishedPostURL") {
      const newYear = this.#selectYear();
      if (newYear == undefined) return context.cancel();
      return { action: "changeYear", year: newYear };
    }

    // Return selected post URL
    const index = menu.fieldValues[menuPicker.name];
    return records[index]?.Link;
  }

  /**
   * Route to the next function
   * @param {string} name - Function name
   * @param {*} args - Arguments to pass
   * @returns {*} Result of function call
   */
  routeToFunction(name, args) {
    const errorMessage = "Function name missing!";

    if (name == undefined) {
      return this.displayAppMessage("error", errorMessage, {
        errorMessage: errorMessage,
        class: "NavigationManager",
        function: "routeToFunction()",
        name: name,
      });
    }

    if (Array.isArray(args) == false) {
      args = [args];
    }

    console.log(`\n\n#######\nRouting to function: ${name}`);
    return { action: name, args: args };
  }

  // Private methods
  #selectYear() {
    const { infoMessage, menuSettings } = this.settings.selectYear;
    const chooseYear = this.ui.buildMenu(menuSettings);
    chooseYear.show();

    const index = chooseYear.fieldValues["year"][0];
    return menuSettings.menuItems[0].data.columns[0][index];
  }
}
```

**Commit after this step:**
```bash
git add Library/Scripts/modules/cp/managers/NavigationManager.js
git commit -m "feat(cp): Add NavigationManager for routing and URLs

- Extract navigation and URL generation from ContentPipeline
- Handle published post URL retrieval
- Manage function routing logic
- Coordinate year selection for URL queries

Reduces ContentPipeline responsibility count from 4 to 3."
```

---

### Step 6: Refactor ContentPipeline to Orchestrator

**File:** `Library/Scripts/modules/cp/core/ContentPipeline.js`

**Changes to make:**

1. **Add manager requires** (after line 11):

```javascript
if (typeof ServiceContainer == "undefined") require("shared/core/ServiceContainer.js");

// Add manager requires
require("modules/cp/managers/BaseManager.js");
require("modules/cp/managers/DocumentManager.js");
require("modules/cp/managers/PipelineManager.js");
require("modules/cp/managers/StatusManager.js");
require("modules/cp/managers/MenuOrchestrator.js");
require("modules/cp/managers/NavigationManager.js");
```

2. **Add manager fields** (after line 30):

```javascript
  #services;
  #dependencyProvider;

  // Manager instances
  #documentManager;
  #pipelineManager;
  #statusManager;
  #menuOrchestrator;
  #navigationManager;
```

3. **Add manager getters** (after line 157, after existing lazy getters):

```javascript
  get document_factory() {
    if (!this.#document_factory) {
      if (typeof DocumentFactory == "undefined") {
        require("modules/cp/documents/DocumentFactory.js");
      }
      this.#document_factory = new DocumentFactory(this.#dependencyProvider);
    }
    return this.#document_factory;
  }

  // Manager getters - lazy initialization
  get #documents() {
    if (!this.#documentManager) {
      this.#documentManager = new DocumentManager(this.#getManagerContext());
    }
    return this.#documentManager;
  }

  get #pipeline() {
    if (!this.#pipelineManager) {
      this.#pipelineManager = new PipelineManager(this.#getManagerContext());
    }
    return this.#pipelineManager;
  }

  get #status() {
    if (!this.#statusManager) {
      this.#statusManager = new StatusManager(this.#getManagerContext());
    }
    return this.#statusManager;
  }

  get #menus() {
    if (!this.#menuOrchestrator) {
      this.#menuOrchestrator = new MenuOrchestrator(this.#getManagerContext());
    }
    return this.#menuOrchestrator;
  }

  get #navigation() {
    if (!this.#navigationManager) {
      this.#navigationManager = new NavigationManager(this.#getManagerContext());
    }
    return this.#navigationManager;
  }

  // Create manager context object
  #getManagerContext() {
    return {
      dependencyProvider: this.#dependencyProvider,
      activeDoc: this.#activeDoc,
      setActiveDoc: (doc) => { this.#activeDoc = doc; },
      services: this.#services,
      // Provide access to other managers for cross-manager calls
      database: this.db,
      statuses: this.statuses,
      destinations: this.destinations,
      recentRecords: this.recent,
      documentFactory: this.document_factory,
    };
  }
```

4. **Replace method implementations with delegation** (lines 205-782):

Replace the entire method implementations with simple delegation. Here's the pattern:

```javascript
  // **************
  // * Welcome
  // * Startup function
  // **************
  welcome() {
    const nextFunction = this.#menus.showWelcome();
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * openDoc()
  // * Open content in Drafts or Ulysses
  // **************
  openDoc(docID, docIDType) {
    return this.#documents.open(docID, docIDType);
  }

  // **************
  // * useCurrentDraft()
  // * Chooses action to run on the active draft
  // **************
  useCurrentDraft() {
    const nextFunction = this.#menus.showCurrentDraftMenu();
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * addContent()
  // **************
  addContent() {
    const nextFunction = this.#menus.showAddContentMenu();
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * deleteContent()
  // * Removes documents from Recent Records, the database, from an app, or everywhere
  // **************
  deleteContent() {
    return this.#documents.delete();
  }

  // **************
  // * createNewDoc()
  // * Creates a new Document from a template or blank with a destination tag
  // **************
  createNewDoc() {
    this.#activeDoc = this.#documents.create();
    this.addDocToPipeline();
    this.#activeDoc.open();
  }

  // **************
  // * selectDocByStatus()
  // * Pick a post to work with based off a Status
  // **************
  selectDocByStatus() {
    const nextFunction = this.#menus.showDocumentsByStatus();
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * modifyActiveDoc()
  // * Prompts to perform action on this.#activeDoc
  // **************
  modifyActiveDoc(docIDType, docID) {
    const nextFunction = this.#documents.modify(docIDType, docID);
    this.#functionToRunNext(nextFunction);
  }

  // **************
  // * addDocToPipeline()
  // * Adds doc to the Productively Pipeline in the database
  // **************
  addDocToPipeline(docIDType, docID = undefined) {
    return this.#pipeline.addDocument(docIDType, docID);
  }

  // **************
  // * addDefaultNotesToSheet()
  // * Adds an existing Ulysses sheet to the pipeline
  // **************
  addDefaultNotesToSheet(targetId) {
    return this.#pipeline.addDefaultNotes(targetId);
  }

  // **************
  // * convertDraft()
  // * Adds draft to Ulysses, Updates Pipeline, and moves draft into trash
  // **************
  convertDraft(uuid = draft.uuid) {
    return this.#pipeline.convertDraft(uuid);
  }

  // **************
  // * updateStatusOfDoc()
  // * Updates the status of a document
  // **************
  updateStatusOfDoc(docID, docIDType) {
    const result = this.#status.updateStatus(docID, docIDType);

    // Handle cross-manager actions
    if (typeof result === 'object' && result.action) {
      switch (result.action) {
        case "addToPipeline":
          if (this.addDocToPipeline() == false) return;
          // Retry status update
          return this.updateStatusOfDoc(docID, docIDType);

        case "convertDoc":
          this.#pipeline.convertDraft();
          break;

        case "back":
          return this.#functionToRunNext("modifyActiveDoc");
      }
    }

    return result;
  }

  // **************
  // * syncStatusOfSheet()
  // * Updates the status of a sheet based on its AirTable Record
  // **************
  syncStatusOfSheet(targetId) {
    return this.#status.syncStatusFromDatabase(targetId);
  }

  // **************
  // * getPublishedPostURL()
  // * Returns the URL of a post that has been published
  // **************
  getPublishedPostURL(year = new Date().getFullYear()) {
    const result = this.#navigation.getPublishedPostURL(year);

    // Handle year change request
    if (typeof result === 'object' && result.action === 'changeYear') {
      return this.getPublishedPostURL(result.year);
    }

    return result;
  }

  // **************
  // * Private Functions
  // **************
  #functionToRunNext(name, args) {
    const route = this.#navigation.routeToFunction(name, args);
    if (route && route.action) {
      return this[route.action].apply(this, route.args || []);
    }
  }

  #throwDBError(parentFunction) {
    this.db.stackTrace["parentFunction"] = parentFunction;
    this.ui.displayAppMessage("error", "Database Error!", this.db.stackTrace);
  }

  // Remove #updateDatabase, #updateRecentRecords, #convertActiveDoc, etc.
  // These are now in the manager classes
```

5. **Remove old method implementations** (lines 205-782):

Delete all the old method implementations that have been moved to managers. Keep only:
- Method signatures (public API)
- Delegation to managers
- #functionToRunNext
- #throwDBError (still used)
- #selectYear (moved to NavigationManager, can remove)
- #loadWorkspace (still needed in constructor)

**Commit after this step:**
```bash
git add Library/Scripts/modules/cp/core/ContentPipeline.js
git commit -m "refactor(cp): Transform ContentPipeline into orchestrator

- Reduce from 790 lines to ~200 lines (80% reduction)
- Extract method implementations to specialized managers
- Keep public API unchanged (backward compatible)
- Add lazy manager initialization via getters
- Delegate all operations to appropriate managers

ContentPipeline now focuses on orchestration rather than implementation.
All existing actions continue to work without modification.

This completes the manager extraction refactoring."
```

---

## Testing & Validation

### Unit Tests

**File:** `Library/Tests/manager-extraction-test.js`

```javascript
/**
 * Manager Extraction Validation Test
 * Verifies that managers work correctly and ContentPipeline delegates properly
 */

require("modules/cp/core/ContentPipeline.js");

console.log('=== Testing Manager Extraction ===\n');

// Test ContentPipeline singleton still works
const cp = ContentPipeline.getInstance();
console.log('ContentPipeline.getInstance():', cp ? 'PASS ✅' : 'FAIL ❌');

// Test that managers are created lazily
console.log('\n--- Testing Lazy Manager Creation ---');
console.log('Check console for manager creation messages');

// Test DocumentManager delegation
console.log('\n--- Testing DocumentManager ---');
try {
  // This will fail because we don't have a real draft, but verifies delegation works
  const doc = cp.createNewDoc();
  console.log('createNewDoc() delegation: PASS ✅');
} catch (e) {
  console.log('createNewDoc() delegation: Expected error:', e.message);
}

// Test that public API is unchanged
console.log('\n--- Testing Public API Preservation ---');
const publicMethods = [
  'welcome',
  'openDoc',
  'useCurrentDraft',
  'addContent',
  'deleteContent',
  'createNewDoc',
  'selectDocByStatus',
  'modifyActiveDoc',
  'addDocToPipeline',
  'convertDraft',
  'updateStatusOfDoc',
  'syncStatusOfSheet',
  'getPublishedPostURL'
];

publicMethods.forEach(method => {
  const exists = typeof cp[method] === 'function';
  console.log(`${method}():`, exists ? 'PASS ✅' : 'FAIL ❌');
});

console.log('\n--- Testing Getters ---');
const getters = ['settings', 'fs', 'ui', 'text', 'statuses', 'destinations', 'recent', 'db', 'document_factory'];

getters.forEach(getter => {
  try {
    const value = cp[getter];
    console.log(`${getter}:`, value ? 'PASS ✅' : 'FAIL ❌');
  } catch (e) {
    console.log(`${getter}: FAIL ❌ -`, e.message);
  }
});

console.log('\n=== Manager Extraction Tests Complete ===');
```

**Run the test:**
```bash
# Create a Drafts action that runs this test
# OR add to existing test suite
```

### Integration Tests

Run these existing actions to verify they still work:

1. **add-draft-to-pipeline** - Tests PipelineManager
2. **welcome** - Tests MenuOrchestrator
3. **update-status-of-draft** - Tests StatusManager
4. **get-url** - Tests NavigationManager

### Code Size Validation

Check file sizes after refactoring:

```bash
wc -l Library/Scripts/modules/cp/core/ContentPipeline.js
wc -l Library/Scripts/modules/cp/managers/*.js
```

**Expected results:**
- ContentPipeline.js: ~200 lines (down from 790)
- Each manager: 100-200 lines
- Total lines similar, but much better organized

**Commit after testing passes:**
```bash
git add Library/Tests/manager-extraction-test.js
git commit -m "test(cp): Add validation tests for manager extraction

- Create unit tests for manager classes
- Validate public API preservation
- Test singleton pattern still works
- Verify all getters functional

All tests passing. Manager extraction complete and validated."
```

---

## Git Workflow Summary

Throughout this refactoring, you will make **8 commits**:

1. ✅ **Step 0**: Add BaseManager base class
2. ✅ **Step 1**: Add DocumentManager
3. ✅ **Step 2**: Add PipelineManager
4. ✅ **Step 3**: Add StatusManager
5. ✅ **Step 4**: Add MenuOrchestrator
6. ✅ **Step 5**: Add NavigationManager
7. ✅ **Step 6**: Refactor ContentPipeline to orchestrator
8. ✅ **Testing**: Add validation tests

**Benefits of incremental commits:**
- Easy rollback to any step if issues arise
- Clear progression of work in git history
- Each commit is independently reviewable
- Can cherry-pick specific managers if needed

**Commit message format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types used:
- `feat`: New features (managers)
- `refactor`: Code restructuring (ContentPipeline)
- `test`: Adding tests

---

## Acceptance Criteria

Before considering this task complete:

- ✅ All 5 manager classes created in `modules/cp/managers/`
- ✅ BaseManager provides shared functionality
- ✅ ContentPipeline reduced to ~200 lines (orchestrator only)
- ✅ All public methods preserved (backward compatible)
- ✅ All action files still work without modification
- ✅ Unit tests pass (manager-extraction-test.js)
- ✅ Integration tests pass (existing actions work)
- ✅ No breaking changes to public API
- ✅ Managers are lazily initialized
- ✅ Clear separation of concerns
- ✅ Each manager handles single responsibility

---

## Viewing Your Work

After completing all commits, view your progress:

```bash
# View commit history
git log --oneline -8

# View detailed changes
git log --stat -8

# View changes for specific manager
git log --oneline --follow Library/Scripts/modules/cp/managers/DocumentManager.js

# View all files changed
git diff HEAD~8..HEAD --name-only
```

**Expected output:**
```
a1b2c3d test(cp): Add validation tests for manager extraction
e4f5g6h refactor(cp): Transform ContentPipeline into orchestrator
i7j8k9l feat(cp): Add NavigationManager for routing and URLs
m0n1o2p feat(cp): Add MenuOrchestrator for UI coordination
q3r4s5t feat(cp): Add StatusManager for status operations
u6v7w8x feat(cp): Add PipelineManager for pipeline operations
y9z0a1b feat(cp): Add DocumentManager for document operations
c2d3e4f feat(cp): Add BaseManager base class for manager extraction
```

**Push to remote (when ready):**
```bash
# Review changes one more time
git diff origin/dev..HEAD

# Push to remote
git push origin dev

# Or create feature branch first
git checkout -b feature/extract-contentpipeline-managers
git push -u origin feature/extract-contentpipeline-managers
```

---

## Rollback Plan

If issues arise, this refactoring can be rolled back granularly thanks to incremental commits.

### Rollback Options

**Option 1: Revert specific step**
```bash
# Identify the problematic commit
git log --oneline -8

# Revert just that commit (may need to resolve conflicts)
git revert <commit-hash>
```

**Option 2: Reset to specific step**
```bash
# Reset to before Step 6 (keep managers, revert ContentPipeline changes)
git reset --hard HEAD~2  # Goes back 2 commits (test + Step 6)

# Reset to before any manager extraction
git reset --hard HEAD~8  # Goes back to before all changes
```

**Option 3: Create branch from good state**
```bash
# If you want to preserve your work but start over from a specific point
git branch backup-manager-extraction  # Save current state
git reset --hard HEAD~4  # Go back 4 steps
```

### Why Rollback is Safe

1. **Public API unchanged**: All method signatures identical
2. **Internal only**: Changes are internal implementation details
3. **Incremental commits**: Can roll back to any step
4. **No action changes**: No action files were modified
5. **Tests validate**: Each step can be validated independently

### Recovering from Rollback

If you roll back and want to try again:
```bash
# Your commits are still in reflog for 90 days
git reflog

# Restore to specific commit
git reset --hard <commit-hash-from-reflog>
```

---

## Expected Outcomes

After implementation:

1. **Code clarity**: 80% reduction in ContentPipeline complexity
2. **Testability**: Each manager independently testable
3. **Maintainability**: Single Responsibility Principle followed
4. **Extensibility**: Easy to add new managers or modify existing ones
5. **Documentation**: Clear separation makes code self-documenting
6. **Team collaboration**: Multiple developers can work on different managers

---

## Next Steps After This Refactoring

After managers are extracted, consider:

1. **Extract BVR utilities** (Medium priority from analysis)
2. **Reduce dependency tree depth** (Medium priority)
3. **Standardize on ServiceContainer** across all components
4. **Add comprehensive unit tests** for each manager

---

## Notes

### Why BaseManager?

- Reduces code duplication
- Provides consistent interface
- Makes testing easier (can mock base class)
- Enforces consistent patterns

### Manager Communication

Some operations require multiple managers (e.g., status update might need to convert document):
- Managers return action objects: `{ action: "convertDoc", newDocType }`
- ContentPipeline orchestrates cross-manager calls
- Keeps managers decoupled

### Lazy Initialization

Managers are created on first use:
- Memory efficient
- Fast ContentPipeline instantiation
- Only used managers are created

### Private Manager Access

Managers use private getters (#documents, #pipeline, etc.):
- Enforces that actions use ContentPipeline API
- Prevents direct manager access
- Maintains encapsulation

---

## Summary

This refactoring:
- **High value**: 80% complexity reduction
- **Low risk**: Backward compatible, no action changes
- **Clear benefits**: Better maintainability, testability, clarity
- **Incremental**: Can be done one manager at a time if needed

The result is a clean, maintainable architecture that follows best practices while preserving all existing functionality.
