/**
 * Test Data Loader
 *
 * Loads standardized test data from JSON files (compiled from YAML).
 * Provides helper functions for accessing test fixtures.
 *
 * Usage:
 *   const testData = loadCPTestData();
 *   const settings = testData.getSettings();
 *   const destinations = testData.getDestinationsData('table1');
 *   const mockRecord = testData.getMockRecord('TEST-DRAFT-UUID-001');
 */

/**
 * Load CP test data from JSON file
 * @returns {Object} Parsed test data
 */
function loadCPTestData() {
  const fs = FileManager.createCloud();
  const path = '/Library/Data/tests/cp-test-data.json';

  try {
    const content = fs.readString(path);
    if (!content) {
      throw new Error(`Test data file not found: ${path}`);
    }
    return JSON.parse(content);
  } catch (e) {
    console.error(`Failed to load test data from ${path}: ${e.message}`);
    throw e;
  }
}

/**
 * TestDataHelper - Provides convenient access to test data
 */
class TestDataHelper {
  constructor(data) {
    this.data = data;
  }

  /**
   * Get settings configuration
   * @returns {Object} Settings object
   */
  getSettings() {
    return this.data.settings;
  }

  /**
   * Get destinations data for a specific table
   * @param {string} tableName - Table name (e.g., 'table1')
   * @returns {Object} Destinations data
   */
  getDestinationsData(tableName = 'table1') {
    return this.data.destinations[tableName] || {};
  }

  /**
   * Get all destinations data (all tables)
   * @returns {Object} All destinations data
   */
  getAllDestinationsData() {
    return this.data.destinations;
  }

  /**
   * Get a mock record by docID
   * @param {string} docID - Document ID
   * @returns {Object|null} Mock record or null if not found
   */
  getMockRecord(docID) {
    return this.data.mockRecords.find(r => r.docID === docID) || null;
  }

  /**
   * Get all mock records
   * @returns {Array} Array of mock records
   */
  getAllMockRecords() {
    return this.data.mockRecords;
  }

  /**
   * Get mock records for a specific destination
   * @param {string} destination - Destination name
   * @returns {Array} Array of mock records
   */
  getMockRecordsByDestination(destination) {
    return this.data.mockRecords.filter(r => r.Destination === destination);
  }

  /**
   * Get mock records by status
   * @param {string} status - Status name
   * @returns {Array} Array of mock records
   */
  getMockRecordsByStatus(status) {
    return this.data.mockRecords.filter(r => r.Status === status);
  }

  /**
   * Get test scenario data
   * @param {string} scenarioName - Scenario name
   * @returns {Object|null} Scenario data or null if not found
   */
  getScenario(scenarioName) {
    return this.data.scenarios[scenarioName] || null;
  }

  /**
   * Create a copy of settings (to avoid mutations)
   * @returns {Object} Deep copy of settings
   */
  getSettingsCopy() {
    return JSON.parse(JSON.stringify(this.data.settings));
  }

  /**
   * Create a copy of destinations data (to avoid mutations)
   * @param {string} tableName - Table name
   * @returns {Object} Deep copy of destinations data
   */
  getDestinationsDataCopy(tableName = 'table1') {
    const dests = this.getDestinationsData(tableName);
    return JSON.parse(JSON.stringify(dests));
  }
}

/**
 * Create a TestDataHelper instance with CP test data
 * @returns {TestDataHelper}
 */
function createCPTestData() {
  const data = loadCPTestData();
  return new TestDataHelper(data);
}

/**
 * Quick access functions for common test data
 */

/**
 * Get CP settings for tests
 * @returns {Object} Settings configuration
 */
function getCPTestSettings() {
  return createCPTestData().getSettings();
}

/**
 * Get destinations data for tests
 * @param {string} tableName - Table name
 * @returns {Object} Destinations data
 */
function getCPTestDestinations(tableName = 'table1') {
  return createCPTestData().getDestinationsData(tableName);
}

/**
 * Get mock records for tests
 * @returns {Array} Array of mock records
 */
function getCPTestMockRecords() {
  return createCPTestData().getAllMockRecords();
}

// Export for use in test files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadCPTestData,
    TestDataHelper,
    createCPTestData,
    getCPTestSettings,
    getCPTestDestinations,
    getCPTestMockRecords,
  };
}
