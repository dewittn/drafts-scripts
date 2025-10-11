/**
 * Mock Services for Testing
 *
 * Provides mock implementations of services for isolated testing.
 * These mocks track interactions and can be configured for different scenarios.
 *
 * Usage:
 *   const mockUI = createMockUI({ debug: true });
 *   ServiceContainer.getInstance().register('cpUI', () => mockUI, true);
 */

/**
 * MockUI - Mock implementation of DraftsUI for testing
 */
class MockUI {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.interactions = [];
    this.promptResponses = options.promptResponses || {};
  }

  /**
   * Display a prompt (returns configured response or default)
   */
  displayPrompt(config) {
    this.interactions.push({ type: 'prompt', config });
    if (this.debug) {
      console.log('[MockUI] Prompt:', config.menuTitle);
    }

    // Return configured response or default
    const key = config.menuTitle || 'default';
    return this.promptResponses[key] || config.defaultValue || null;
  }

  /**
   * Display error message
   */
  displayErrorMessage(config) {
    this.interactions.push({ type: 'error', config });
    if (this.debug) {
      console.log('[MockUI] Error:', config.errorMessage);
    }
  }

  /**
   * Display info message
   */
  displayInfoMessage(config) {
    this.interactions.push({ type: 'info', config });
    if (this.debug) {
      console.log('[MockUI] Info:', config.infoMessage);
    }
  }

  /**
   * Display success message
   */
  displaySuccessMessage(config) {
    this.interactions.push({ type: 'success', config });
    if (this.debug) {
      console.log('[MockUI] Success:', config.successMessage);
    }
  }

  /**
   * Debug variable (used for testing)
   */
  debugVariable(variable, label = '') {
    this.interactions.push({ type: 'debug', variable, label });
    if (this.debug) {
      console.log('[MockUI] Debug:', label, JSON.stringify(variable, null, 2));
    }
  }

  /**
   * Display app message (used by CP components for error/info/success)
   * @param {string} messageType - Type of message ('error', 'info', 'success')
   * @param {string} message - Message to display
   * @param {Object} debugData - Optional debug data
   */
  displayAppMessage(messageType, message, debugData = null) {
    this.interactions.push({ type: 'appMessage', messageType, message, debugData });
    if (this.debug) {
      console.log(`[MockUI] App Message [${messageType}]:`, message);
      if (debugData) {
        console.log('[MockUI] Debug Data:', JSON.stringify(debugData, null, 2));
      }
    }
    // Return undefined to simulate message display without halting execution
    return undefined;
  }

  /**
   * Build menu (used by select methods)
   * @param {Object} menuSettings - Menu configuration
   * @returns {Object} Mock prompt object
   */
  buildMenu(menuSettings) {
    this.interactions.push({ type: 'buildMenu', menuSettings });
    if (this.debug) {
      console.log('[MockUI] Build Menu:', menuSettings.menuTitle);
    }

    // Return a mock prompt object
    return {
      show: () => {
        if (this.debug) {
          console.log('[MockUI] Show prompt');
        }
        return false; // Simulate cancelled prompt in tests
      },
      fieldValues: {}
    };
  }

  /**
   * Get all interactions for assertions
   */
  getInteractions() {
    return this.interactions;
  }

  /**
   * Get interactions of a specific type
   */
  getInteractionsByType(type) {
    return this.interactions.filter(i => i.type === type);
  }

  /**
   * Clear interaction history
   */
  clearInteractions() {
    this.interactions = [];
  }

  /**
   * Configure response for a specific prompt
   */
  setPromptResponse(promptTitle, response) {
    this.promptResponses[promptTitle] = response;
  }
}

/**
 * MockDatabase - Mock implementation of database for testing
 */
class MockDatabase {
  constructor(testRecords = [], options = {}) {
    this.records = new Map(testRecords.map(r => [r.docID, r]));
    this.queries = [];
    this.debug = options.debug || false;
    this.shouldFail = options.shouldFail || false;
    this.databaseError = false;
  }

  /**
   * Retrieve record by docID
   */
  retrieveRecordByDocID(doc) {
    this.queries.push({ type: 'getByDocID', doc });
    if (this.debug) {
      console.log('[MockDatabase] Query: getByDocID', doc.docID);
    }

    if (this.shouldFail) {
      this.databaseError = true;
      return null;
    }

    const record = this.records.get(doc.docID);
    return record || null;
  }

  /**
   * Retrieve record by field value
   */
  retrieveRecordByField(field, value) {
    this.queries.push({ type: 'getByField', field, value });
    if (this.debug) {
      console.log('[MockDatabase] Query: getByField', field, value);
    }

    if (this.shouldFail) {
      this.databaseError = true;
      return null;
    }

    for (const record of this.records.values()) {
      if (record[field] === value) {
        return record;
      }
    }
    return null;
  }

  /**
   * Retrieve record by ID
   */
  retrieveRecordById(id) {
    this.queries.push({ type: 'getById', id });
    if (this.debug) {
      console.log('[MockDatabase] Query: getById', id);
    }

    if (this.shouldFail) {
      this.databaseError = true;
      return null;
    }

    for (const record of this.records.values()) {
      if (record.id === id) {
        return record;
      }
    }
    return null;
  }

  /**
   * Update record using doc
   */
  updateUsingDoc(doc) {
    this.queries.push({ type: 'update', doc });
    if (this.debug) {
      console.log('[MockDatabase] Update:', doc.docID);
    }

    if (this.shouldFail) {
      this.databaseError = true;
      return null;
    }

    // In a real implementation, this would update the record
    return this.records.get(doc.docID) || null;
  }

  /**
   * Create new record
   */
  createRecord(fields) {
    this.queries.push({ type: 'create', fields });
    if (this.debug) {
      console.log('[MockDatabase] Create:', fields);
    }

    if (this.shouldFail) {
      this.databaseError = true;
      return null;
    }

    // In a real implementation, this would create a record
    const newRecord = { id: `rec${Date.now()}`, ...fields };
    this.records.set(newRecord.docID, newRecord);
    return newRecord;
  }

  /**
   * Get all queries for assertions
   */
  getQueries() {
    return this.queries;
  }

  /**
   * Get queries of a specific type
   */
  getQueriesByType(type) {
    return this.queries.filter(q => q.type === type);
  }

  /**
   * Clear query history
   */
  clearQueries() {
    this.queries = [];
  }

  /**
   * Reset error state
   */
  resetError() {
    this.databaseError = false;
  }

  /**
   * Set whether operations should fail
   */
  setShouldFail(shouldFail) {
    this.shouldFail = shouldFail;
    if (!shouldFail) {
      this.databaseError = false;
    }
  }
}

/**
 * MockFileSystem - Mock implementation of FileSystem for testing
 */
class MockFileSystem {
  constructor(testData = {}, options = {}) {
    this.data = testData;
    this.operations = [];
    this.debug = options.debug || false;
  }

  /**
   * Read file (CloudFS-compatible interface)
   * Returns JSON data for destinations, settings, etc.
   */
  read(fileName) {
    this.operations.push({ type: 'read', fileName });
    if (this.debug) {
      console.log('[MockFS] Read:', fileName);
    }

    // Map file names to test data properties
    if (fileName && fileName.includes('destinations')) {
      const destinations = this.data.destinations || {};

      // Normalize destination keys to lowercase for lookupAirTableDestinationName
      // which uses .toLowerCase() internally
      const normalizeDestinationKeys = (tableData) => {
        const normalized = {};
        for (const [key, value] of Object.entries(tableData)) {
          // Keep both original case and lowercase keys
          normalized[key] = value; // Original case for other methods
          if (key !== key.toLowerCase()) {
            normalized[key.toLowerCase()] = value; // Lowercase for lookupAirTableDestinationName
          }
        }
        return normalized;
      };

      // Map "Content" table to "table1" for testing and normalize keys
      // ContentPipeline defaults to "Content" but test data uses "table1"
      if (destinations.table1 && !destinations.Content) {
        return {
          ...destinations,
          Content: normalizeDestinationKeys(destinations.table1),
          table1: normalizeDestinationKeys(destinations.table1)
        };
      }

      // Normalize all table keys
      const normalizedDestinations = {};
      for (const [tableName, tableData] of Object.entries(destinations)) {
        normalizedDestinations[tableName] = normalizeDestinationKeys(tableData);
      }

      return normalizedDestinations;
    }
    if (fileName && fileName.includes('settings')) {
      return this.data.settings || {};
    }

    // Fallback to direct lookup
    return this.data[fileName] || null;
  }

  /**
   * Read file (legacy interface)
   */
  readFile(path) {
    this.operations.push({ type: 'read', path });
    if (this.debug) {
      console.log('[MockFS] Read:', path);
    }
    return this.data[path] || null;
  }

  /**
   * Write file
   */
  writeFile(path, content) {
    this.operations.push({ type: 'write', path, content });
    if (this.debug) {
      console.log('[MockFS] Write:', path);
    }
    this.data[path] = content;
  }

  /**
   * Check if file exists
   */
  fileExists(path) {
    this.operations.push({ type: 'exists', path });
    if (this.debug) {
      console.log('[MockFS] Exists:', path);
    }
    return path in this.data;
  }

  /**
   * Delete file
   */
  deleteFile(path) {
    this.operations.push({ type: 'delete', path });
    if (this.debug) {
      console.log('[MockFS] Delete:', path);
    }
    delete this.data[path];
  }

  /**
   * Get all operations for assertions
   */
  getOperations() {
    return this.operations;
  }

  /**
   * Get operations of a specific type
   */
  getOperationsByType(type) {
    return this.operations.filter(o => o.type === type);
  }

  /**
   * Clear operation history
   */
  clearOperations() {
    this.operations = [];
  }
}

/**
 * MockUlysses - Mock implementation of Ulysses for testing
 */
class MockUlysses {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.operations = [];
    this.sheets = new Map();
    this.nextSheetId = 1;
    this.error = false;
    this.errorCode = 0;
    this.errorMessage = '';
  }

  /**
   * Create a new sheet
   * @param {string} content - Sheet content
   * @param {string} groupID - Group ID
   * @returns {Object} Sheet object
   */
  newSheet(content, groupID) {
    this.operations.push({ type: 'newSheet', content, groupID });
    if (this.debug) {
      console.log('[MockUlysses] newSheet:', groupID);
    }

    const sheetId = `mock-ulysses-${this.nextSheetId++}`;
    const sheet = {
      identifier: sheetId,
      title: this._extractTitle(content),
      text: content,
      keywords: [],
      notes: [],
      groupID: groupID,
      hasKeyword: function(keyword) {
        return this.keywords.includes(keyword);
      }
    };

    this.sheets.set(sheetId, sheet);
    return sheet;
  }

  /**
   * Read a sheet by ID
   * @param {string} sheetId - Sheet identifier
   * @returns {Object} Sheet object
   */
  readSheet(sheetId) {
    this.operations.push({ type: 'readSheet', sheetId });
    if (this.debug) {
      console.log('[MockUlysses] readSheet:', sheetId);
    }

    const sheet = this.sheets.get(sheetId);
    if (!sheet) {
      this.error = true;
      this.errorCode = 1;
      this.errorMessage = 'Sheet not found';
      return null;
    }

    this.error = false;
    this.errorCode = 0;
    this.errorMessage = '';
    return sheet;
  }

  /**
   * Attach keywords to a sheet
   * @param {string} sheetId - Sheet identifier
   * @param {string} keywords - Comma-separated keywords
   */
  attachKeywords(sheetId, keywords) {
    this.operations.push({ type: 'attachKeywords', sheetId, keywords });
    if (this.debug) {
      console.log('[MockUlysses] attachKeywords:', sheetId, keywords);
    }

    const sheet = this.sheets.get(sheetId);
    if (sheet) {
      const keywordArray = keywords.split(',').map(k => k.trim());
      sheet.keywords.push(...keywordArray);
    }
  }

  /**
   * Remove keywords from a sheet
   * @param {string} sheetId - Sheet identifier
   * @param {string} keywords - Comma-separated keywords
   */
  removeKeywords(sheetId, keywords) {
    this.operations.push({ type: 'removeKeywords', sheetId, keywords });
    if (this.debug) {
      console.log('[MockUlysses] removeKeywords:', sheetId, keywords);
    }

    const sheet = this.sheets.get(sheetId);
    if (sheet) {
      const keywordsToRemove = keywords.split(',').map(k => k.trim());
      sheet.keywords = sheet.keywords.filter(k => !keywordsToRemove.includes(k));
    }
  }

  /**
   * Attach a note to a sheet
   * @param {string} sheetId - Sheet identifier
   * @param {string} note - Note text
   */
  attachNote(sheetId, note) {
    this.operations.push({ type: 'attachNote', sheetId, note });
    if (this.debug) {
      console.log('[MockUlysses] attachNote:', sheetId);
    }

    const sheet = this.sheets.get(sheetId);
    if (sheet) {
      sheet.notes.push(note);
    }
  }

  /**
   * Remove a note from a sheet
   * @param {string} sheetId - Sheet identifier
   * @param {number} index - Note index
   */
  removeNote(sheetId, index) {
    this.operations.push({ type: 'removeNote', sheetId, index });
    if (this.debug) {
      console.log('[MockUlysses] removeNote:', sheetId, index);
    }

    const sheet = this.sheets.get(sheetId);
    if (sheet && index >= 0 && index < sheet.notes.length) {
      sheet.notes.splice(index, 1);
    }
  }

  /**
   * Open a sheet
   * @param {string} sheetId - Sheet identifier
   */
  open(sheetId) {
    this.operations.push({ type: 'open', sheetId });
    if (this.debug) {
      console.log('[MockUlysses] open:', sheetId);
    }
  }

  /**
   * Trash a sheet
   * @param {string} sheetId - Sheet identifier
   */
  trash(sheetId) {
    this.operations.push({ type: 'trash', sheetId });
    if (this.debug) {
      console.log('[MockUlysses] trash:', sheetId);
    }
    this.sheets.delete(sheetId);
  }

  /**
   * Extract title from content (first line)
   */
  _extractTitle(content) {
    const lines = content.split('\n');
    const firstLine = lines[0] || 'Untitled';
    // Remove markdown heading markers
    return firstLine.replace(/^#+\s*/, '').trim();
  }

  /**
   * Get all operations for assertions
   */
  getOperations() {
    return this.operations;
  }

  /**
   * Get operations of a specific type
   */
  getOperationsByType(type) {
    return this.operations.filter(o => o.type === type);
  }

  /**
   * Clear operation history
   */
  clearOperations() {
    this.operations = [];
  }

  /**
   * Get a sheet by ID (for testing)
   */
  getSheet(sheetId) {
    return this.sheets.get(sheetId);
  }

  /**
   * Reset mock state
   */
  reset() {
    this.operations = [];
    this.sheets.clear();
    this.nextSheetId = 1;
    this.error = false;
    this.errorCode = 0;
    this.errorMessage = '';
  }
}

/**
 * Factory functions for creating mock services
 */

/**
 * Create a MockUI instance
 * @param {Object} options - Configuration options
 * @returns {MockUI}
 */
function createMockUI(options = {}) {
  return new MockUI(options);
}

/**
 * Create a MockDatabase instance
 * @param {Array} testRecords - Test records
 * @param {Object} options - Configuration options
 * @returns {MockDatabase}
 */
function createMockDatabase(testRecords = [], options = {}) {
  return new MockDatabase(testRecords, options);
}

/**
 * Create a MockFileSystem instance
 * @param {Object} testData - Test file data
 * @param {Object} options - Configuration options
 * @returns {MockFileSystem}
 */
function createMockFileSystem(testData = {}, options = {}) {
  return new MockFileSystem(testData, options);
}

/**
 * Create a MockUlysses instance
 * @param {Object} options - Configuration options
 * @returns {MockUlysses}
 */
function createMockUlysses(options = {}) {
  return new MockUlysses(options);
}

/**
 * Alias for createMockFileSystem (shorter name)
 * @param {Object} testData - Test file data
 * @param {Object} options - Configuration options
 * @returns {MockFileSystem}
 */
function createMockFS(testData = {}, options = {}) {
  return createMockFileSystem(testData, options);
}

// Export for use in test files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MockUI,
    MockDatabase,
    MockFileSystem,
    MockUlysses,
    createMockUI,
    createMockDatabase,
    createMockFileSystem,
    createMockFS,
    createMockUlysses,
  };
}
