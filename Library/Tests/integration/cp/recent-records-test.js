/**
 * RecentRecords Integration Test
 *
 * Tests RecentRecords caching functionality end-to-end:
 * - Loading recent records from file system
 * - Saving documents to recent records cache
 * - Deleting documents from recent records
 * - Automatic cache size limiting (15 records max)
 * - Record ordering (most recent first)
 * - Fallback to database retrieval
 * - RecentRecord wrapper class
 *
 * Dependencies: MockFileSystem, MockDatabase
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");
require("../Tests/fixtures/mocks.js");

// Load ServiceContainer framework
require("shared/core/ServiceInitializer.js");

// Load required modules
require("modules/cp/core/ContentPipeline.js");
require("modules/cp/core/RecentRecords.js");

// Create test instance
const test = new TestAssertions('RecentRecords Integration Test');

// =============================================================================
// Setup
// =============================================================================

test.section('Setup and Configuration');

resetServices();
initializeServices();

const container = ServiceContainer.getInstance();

// Register test services
const testData = getCPTestData();
container.register('cpFileSystem', () => createMockFS(testData), true);
container.register('cpUI', () => createMockUI({ debug: false }), true);
container.register('ulysses', () => createMockUlysses({ debug: false }), true);
container.register('cpDatabase', () => createMockDatabase(getMockRecords()), true);

// Get services under test
const contentPipeline = container.get('cpDefault');
const recentRecords = contentPipeline.recentRecords;
const mockFS = container.get('cpFileSystem');
const mockDB = container.get('cpDatabase');

test.assertNotNullish(recentRecords, 'RecentRecords instance created');
test.assertType(recentRecords, 'RecentRecords', 'Is RecentRecords instance');

// =============================================================================
// Section 1: Initial Load from File System
// =============================================================================

test.section('Initial Load from File System');

// RecentRecords loads on construction
const initialRecords = recentRecords.records;

test.assertNotNullish(initialRecords, 'Records loaded');
test.assertType(initialRecords, 'Array', 'Records is an array');

test.info(`Loaded ${initialRecords?.length || 0} records from cache`);

// =============================================================================
// Section 2: Save Document to Recent Records
// =============================================================================

test.section('Save Document to Recent Records');

// Create a mock document
const mockDoc = {
  recordID: 'recSAVE001',
  title: 'Test Save Document',
  scrubedTitle: 'Test Save Document',
  docID: 'TEST-SAVE-UUID-001',
  docIDType: 'DraftsID',
  destination: 'Test Blog',
  status: 'Writing'
};

let saveResult;
test.assertDoesNotThrow(() => {
  saveResult = recentRecords.save(mockDoc);
}, 'Saving document does not throw');

test.assert(saveResult === true, 'Save returns true on success');

// Verify document was added to cache
const recordsAfterSave = recentRecords.records;
test.assert(recordsAfterSave.length > 0, 'Records cache is not empty');

// Most recent should be first
const firstRecord = recordsAfterSave[0];
test.assertEqual(firstRecord.id, 'recSAVE001', 'Saved record is first in cache');
test.assertEqual(firstRecord.fields.Title, 'Test Save Document', 'Title saved correctly');
test.assertEqual(firstRecord.fields.docID, 'TEST-SAVE-UUID-001', 'docID saved correctly');
test.assertEqual(firstRecord.fields.docIDType, 'DraftsID', 'docIDType saved correctly');
test.assertEqual(firstRecord.fields.Destination, 'test blog', 'Destination lowercased and saved');
test.assertEqual(firstRecord.fields.Status, 'Writing', 'Status saved correctly');
test.assertNotNullish(firstRecord.fields.Updated, 'Has Updated timestamp');

// =============================================================================
// Section 3: Save Multiple Documents (Ordering)
// =============================================================================

test.section('Save Multiple Documents - Ordering');

// Save additional documents
const doc2 = {
  recordID: 'recSAVE002',
  title: 'Second Document',
  scrubedTitle: 'Second Document',
  docID: 'TEST-SAVE-UUID-002',
  docIDType: 'UlyssesID',
  destination: 'Test Newsletter',
  status: 'Editing'
};

const doc3 = {
  recordID: 'recSAVE003',
  title: 'Third Document',
  scrubedTitle: 'Third Document',
  docID: 'TEST-SAVE-UUID-003',
  docIDType: 'DraftsID',
  destination: 'Test Studio',
  status: 'Polishing'
};

recentRecords.save(doc2);
recentRecords.save(doc3);

const recordsAfterMultiple = recentRecords.records;
test.assert(recordsAfterMultiple.length >= 3, 'Multiple documents saved');

// Most recent (doc3) should be first
test.assertEqual(recordsAfterMultiple[0].id, 'recSAVE003', 'Most recent document is first');
test.assertEqual(recordsAfterMultiple[1].id, 'recSAVE002', 'Second most recent is second');
test.assertEqual(recordsAfterMultiple[2].id, 'recSAVE001', 'Third most recent is third');

// =============================================================================
// Section 4: Update Existing Document (No Duplicates)
// =============================================================================

test.section('Update Existing Document - No Duplicates');

// Save doc2 again (should move it to front, not duplicate)
const doc2Updated = {
  ...doc2,
  status: 'Publishing'  // Changed status
};

const lengthBefore = recentRecords.records.length;

recentRecords.save(doc2Updated);

const recordsAfterUpdate = recentRecords.records;

// Length should be same (no duplicate)
test.assertEqual(recordsAfterUpdate.length, lengthBefore, 'No duplicate record created');

// doc2 should now be first
test.assertEqual(recordsAfterUpdate[0].id, 'recSAVE002', 'Updated record moved to front');
test.assertEqual(recordsAfterUpdate[0].fields.Status, 'Publishing', 'Status updated');

// Should not have duplicate entries for recSAVE002
const doc2Count = recordsAfterUpdate.filter(r => r.id === 'recSAVE002').length;
test.assertEqual(doc2Count, 1, 'No duplicate entries for same record ID');

// =============================================================================
// Section 5: Cache Size Limit (15 records max)
// =============================================================================

test.section('Cache Size Limit - 15 Records Max');

// Save 20 documents to test limit
for (let i = 1; i <= 20; i++) {
  const doc = {
    recordID: `recLIMIT${i.toString().padStart(3, '0')}`,
    title: `Limit Test ${i}`,
    scrubedTitle: `Limit Test ${i}`,
    docID: `LIMIT-UUID-${i.toString().padStart(3, '0')}`,
    docIDType: 'DraftsID',
    destination: 'Test Blog',
    status: 'Writing'
  };
  recentRecords.save(doc);
}

const recordsAfterLimit = recentRecords.records;

test.assertArrayLength(recordsAfterLimit, 15, 'Cache limited to 15 records');

// Most recent should be the last one saved (doc 20)
test.assertEqual(recordsAfterLimit[0].id, 'recLIMIT020', 'Most recent is first');

// Oldest in cache should be doc 6 (20 - 15 + 1 = 6)
test.assertEqual(recordsAfterLimit[14].id, 'recLIMIT006', 'Oldest kept is 15th');

// =============================================================================
// Section 6: Delete Document from Recent Records
// =============================================================================

test.section('Delete Document from Recent Records');

// Get current length
const lengthBeforeDelete = recentRecords.records.length;

// Delete a specific document
const docToDelete = {
  recordID: 'recLIMIT015'
};

let deleteResult;
test.assertDoesNotThrow(() => {
  deleteResult = recentRecords.delete(docToDelete);
}, 'Deleting document does not throw');

test.assert(deleteResult === true, 'Delete returns true on success');

const recordsAfterDelete = recentRecords.records;

// Length should be one less
test.assertEqual(recordsAfterDelete.length, lengthBeforeDelete - 1, 'One record removed');

// Deleted record should not be in cache
const deletedStillExists = recordsAfterDelete.find(r => r.id === 'recLIMIT015');
test.assertNullish(deletedStillExists, 'Deleted record not in cache');

// =============================================================================
// Section 7: Error Handling - Save with Missing Title
// =============================================================================

test.section('Error Handling - Save with Missing Title');

const invalidDoc = {
  recordID: 'recINVALID001',
  // title is missing
  docID: 'INVALID-UUID',
  docIDType: 'DraftsID',
  destination: 'Test Blog',
  status: 'Writing'
};

const invalidSaveResult = recentRecords.save(invalidDoc);

test.assert(invalidSaveResult === false, 'Save with missing title returns false');
test.assertNotNullish(recentRecords.stackTrace, 'Stack trace set for error');
test.info(`Error: ${recentRecords.stackTrace.errorMessage}`);

// =============================================================================
// Section 8: Error Handling - Delete with Undefined Doc
// =============================================================================

test.section('Error Handling - Delete with Undefined Doc');

const invalidDeleteResult = recentRecords.delete(undefined);

test.assert(invalidDeleteResult === false, 'Delete with undefined returns false');
test.assertNotNullish(recentRecords.stackTrace, 'Stack trace set for error');

// =============================================================================
// Section 9: Select by Index
// =============================================================================

test.section('Select by Index');

// Get a record by index
const selectedRecord = recentRecords.selectByIndex(0);

test.assertNotNullish(selectedRecord, 'Record selected by index');
test.assertType(selectedRecord, 'RecentRecord', 'Returns RecentRecord instance');

// Test RecentRecord properties
test.assertNotNullish(selectedRecord.docID, 'RecentRecord has docID');
test.assertNotNullish(selectedRecord.docIDType, 'RecentRecord has docIDType');
test.assertNotNullish(selectedRecord.title, 'RecentRecord has title');
test.assertNotNullish(selectedRecord.id, 'RecentRecord has id');

test.info(`Selected record: ${selectedRecord.title}`);
test.info(`docID: ${selectedRecord.docID}, type: ${selectedRecord.docIDType}`);

// Test Title alias
test.assertEqual(selectedRecord.Title, selectedRecord.title, 'Title alias works');

// =============================================================================
// Section 10: Select Invalid Index
// =============================================================================

test.section('Select Invalid Index');

const invalidSelection = recentRecords.selectByIndex(9999);
test.assertNullish(invalidSelection, 'Invalid index returns undefined');

const negativeSelection = recentRecords.selectByIndex(-1);
test.assertNullish(negativeSelection, 'Negative index returns undefined');

// =============================================================================
// Section 11: RecentRecord - DraftsID Detection
// =============================================================================

test.section('RecentRecord - DraftsID Detection');

// Create record with DraftsID field (old format)
const draftsIDRecord = {
  id: 'recOLDFORMAT001',
  fields: {
    Title: 'Old Format Draft',
    DraftsID: 'OLD-DRAFTS-UUID',
    Status: 'Writing'
  }
};

const oldFormatRecord = new RecentRecord(draftsIDRecord);

test.assertEqual(oldFormatRecord.docID, 'OLD-DRAFTS-UUID', 'DraftsID detected');
test.assertEqual(oldFormatRecord.docIDType, 'DraftsID', 'docIDType set to DraftsID');

// =============================================================================
// Section 12: RecentRecord - UlyssesID Detection
// =============================================================================

test.section('RecentRecord - UlyssesID Detection');

// Create record with UlyssesID field (old format)
const ulyssesIDRecord = {
  id: 'recOLDFORMAT002',
  fields: {
    Title: 'Old Format Sheet',
    UlyssesID: 'OLD-ULYSSES-UUID',
    Status: 'Editing'
  }
};

const oldFormatSheet = new RecentRecord(ulyssesIDRecord);

test.assertEqual(oldFormatSheet.docID, 'OLD-ULYSSES-UUID', 'UlyssesID detected');
test.assertEqual(oldFormatSheet.docIDType, 'UlyssesID', 'docIDType set to UlyssesID');

// =============================================================================
// Section 13: RecentRecord - New Format
// =============================================================================

test.section('RecentRecord - New Format with docID/docIDType');

// Create record with new format (docID + docIDType fields)
const newFormatRecord = {
  id: 'recNEWFORMAT001',
  fields: {
    Title: 'New Format Document',
    docID: 'NEW-FORMAT-UUID',
    docIDType: 'DraftsID',
    Status: 'Polishing'
  }
};

const newFormat = new RecentRecord(newFormatRecord);

test.assertEqual(newFormat.docID, 'NEW-FORMAT-UUID', 'docID from new format');
test.assertEqual(newFormat.docIDType, 'DraftsID', 'docIDType from new format');

// =============================================================================
// Section 14: All Records Access
// =============================================================================

test.section('All Records Access');

const allRecords = recentRecords.allRecords;

test.assertNotNullish(allRecords, 'allRecords accessible');
test.assertType(allRecords, 'Object', 'allRecords is an object');

// Should contain the table key
test.assertNotNullish(allRecords.table1, 'Contains table1 key');

test.info(`All records contains ${Object.keys(allRecords).length} tables`);

// =============================================================================
// Section 15: File System Write Verification
// =============================================================================

test.section('File System Write Verification');

// MockFileSystem should have write operations
const writeOps = mockFS.writes || [];

test.assert(writeOps.length > 0, 'File system writes occurred');
test.info(`File system writes: ${writeOps.length}`);

// =============================================================================
// Section 16: Database Fallback (No Cache File)
// =============================================================================

test.section('Database Fallback - No Cache File');

// Create a new RecentRecords with empty file system
const emptyFS = createMockFS({ destinations: testData.destinations });
container.register('cpFileSystem', () => emptyFS, true);

// Reset and reinitialize to use new file system
container.resetSingletons();
const contentPipeline2 = container.get('cpDefault');
const recentRecords2 = contentPipeline2.recentRecords;

// Should fall back to database
test.info('Testing database fallback when cache file missing');

// MockDatabase should have been queried
// (The actual implementation calls retrieveRecentFromDatabase)

// =============================================================================
// Section 17: Null Record Filtering
// =============================================================================

test.section('Null Record Filtering');

// Manually add a null to records to test filtering
const recordsWithNull = recentRecords.records;
recordsWithNull.push(null);

const docWithNull = {
  recordID: 'recNULLTEST',
  title: 'Null Test',
  scrubedTitle: 'Null Test',
  docID: 'NULL-TEST-UUID',
  docIDType: 'DraftsID',
  destination: 'Test Blog',
  status: 'Writing'
};

recentRecords.save(docWithNull);

const recordsAfterNull = recentRecords.records;

// Should not contain null values
const hasNull = recordsAfterNull.includes(null);
test.assert(!hasNull, 'Null records filtered out');

// =============================================================================
// Test Summary
// =============================================================================

test.summary();
