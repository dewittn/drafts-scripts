/**
 * Convert Draft to Sheet Integration Test
 *
 * Tests the complete workflow of converting a Draft document to a Sheet document.
 * Demonstrates ServiceContainer pattern and integration testing approach.
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");
require("../Tests/fixtures/mocks.js");

// Load ServiceContainer framework
require("shared/core/ServiceInitializer.js");

// Load required modules
require("modules/cp/core/Statuses.js");
require("modules/cp/core/Destinations.js");
require("modules/cp/core/RecentRecords.js");
require("modules/cp/utils/TextUtilities.js");
require("modules/cp/documents/DocumentFactory.js");

// Load test implementations
require("modules/cp/databases/TestDB.js");
require("modules/cp/filesystems/TestFS.js");

// Create test instance
const test = new TestAssertions('Convert Draft to Sheet Integration Test');

// Setup: Load test data
const testData = createCPTestData();
const settings = testData.getSettingsCopy();
const destinationsData = testData.getDestinationsData('table1');
const scenario = testData.getScenario('documentConversion');

test.section('Test Setup and Configuration');

// Initialize service container
const container = ServiceContainer.getInstance();
container.reset(); // Clean slate for this test

test.info('Configuring mock services...');

// Create mock services
const mockUI = createMockUI({ debug: true });
const mockFS = new TestFS({ table1: destinationsData });
const textUtilities = new TextUtilities();
const mockUlysses = createMockUlysses({ debug: true });

// Create dependencies object
const dependencies = {
  ui: mockUI,
  fileSystem: mockFS,
  settings: settings,
  tableName: 'table1',
  textUtilities: textUtilities,
  ulysses: mockUlysses,
  defaultTag: settings.defaultTag,
};

// Initialize core services
const statuses = new Statuses(dependencies);
dependencies['statuses'] = statuses;

const destinations = new Destinations(dependencies);
dependencies['destinations'] = destinations;

const documentFactory = new DocumentFactory(dependencies);

test.assert(true, 'Test dependencies configured successfully');

test.section('Create Test Draft Document');

// Create a test draft with the Drafts API
const timeCode = new Date().toString();
const testDraft = new Draft();

testDraft.addTag(settings.defaultTag);
testDraft.addTag(scenario.sourceDraft.tags[1]); // "Writing"
testDraft.addTag(scenario.sourceDraft.tags[2]); // "Test Blog"
testDraft.content = scenario.sourceDraft.content.replace(
  'This is a test draft created for conversion testing.',
  `This is a test draft created: ${timeCode}.`
);
testDraft.update();

test.assertNotNullish(testDraft.uuid, 'Test draft created with UUID');
test.assert(testDraft.hasTag(settings.defaultTag), 'Draft has "In Pipeline" tag');
test.info(`Test draft UUID: ${testDraft.uuid}`);

test.section('Load Draft as Document');

// Load the draft using DocumentFactory
const record = {
  docID: testDraft.uuid,
  docIDType: 'DraftsID',
};

let activeDoc;
test.assertDoesNotThrow(() => {
  activeDoc = documentFactory.load(record);
}, 'DocumentFactory loads draft without error');

test.assertNotNullish(activeDoc, 'Active document loaded');
test.assertType(activeDoc, 'DraftsDoc', 'Loaded document is DraftsDoc type');

// Set pipeline status
activeDoc.inPipeline = true;
test.assert(activeDoc.inPipeline, 'Document marked as in pipeline');

test.section('Extract Document Properties');

// Verify document properties before conversion
const sourceStatus = activeDoc.status;
const sourceDestination = activeDoc.destination;
const sourceContent = activeDoc.content;

test.assertNotNullish(sourceStatus, 'Source document has status');
test.assertEqual(sourceStatus, 'Writing', 'Status matches test data');
test.assertNotNullish(sourceDestination, 'Source document has destination');
test.assertEqual(sourceDestination, 'Test Blog', 'Destination matches test data');
test.assertNotNullish(sourceContent, 'Source document has content');
test.assert(sourceContent.length > 0, 'Content is not empty');

test.info(`Source status: ${sourceStatus}`);
test.info(`Source destination: ${sourceDestination}`);
test.info(`Content length: ${sourceContent.length} characters`);

test.section('Convert Draft to Sheet');

// Create new Sheet document with same properties
let newDoc;
test.assertDoesNotThrow(() => {
  newDoc = documentFactory.create('sheet');
}, 'DocumentFactory creates sheet without error');

test.assertNotNullish(newDoc, 'New sheet document created');
test.assertType(newDoc, 'UlyssesDoc', 'Created document is UlyssesDoc type');

// Transfer properties
newDoc.status = sourceStatus;
newDoc.destination = sourceDestination;
newDoc.content = sourceContent;

test.assertEqual(newDoc.status, sourceStatus, 'Status transferred correctly');
test.assertEqual(newDoc.destination, sourceDestination, 'Destination transferred correctly');
test.assertEqual(newDoc.content, sourceContent, 'Content transferred correctly');

test.section('Save Converted Document');

// Save the new sheet
test.assertDoesNotThrow(() => {
  newDoc.save();
}, 'Sheet document saves without error');

test.assertNotNullish(newDoc.docID, 'Sheet has docID after save');
test.info(`New sheet docID: ${newDoc.docID}`);

test.section('Link Documents');

// Save docIDs before modifying the shared record object
// (both activeDoc and newDoc reference the same record object)
const originalDraftDocID = activeDoc.docID;
const newSheetDocID = newDoc.docID;

// Link the new sheet to the original draft record
// Note: Setting the record updates it to point to the new sheet's docID
newDoc.record = record;

test.assertNotNullish(newDoc.record, 'Sheet linked to record');
test.assertEqual(newDoc.record.docID, newDoc.docID, 'Record docID updated to new sheet ID');
test.assertEqual(newDoc.record.docIDType, 'UlyssesID', 'Record docIDType updated to UlyssesID');

test.info(`Original draft UUID: ${testDraft.uuid}`);
test.info(`New sheet docID: ${newDoc.docID}`);

test.section('Verify Conversion Results');

// Verify the conversion was successful (using cached docIDs)
test.assert(newSheetDocID !== originalDraftDocID, 'New document has different docID');
test.assertEqual(newDoc.status, activeDoc.status, 'Status preserved in conversion');
test.assertEqual(newDoc.destination, activeDoc.destination, 'Destination preserved in conversion');
test.assertEqual(newDoc.content, activeDoc.content, 'Content preserved in conversion');

test.section('Cleanup');

// In a real workflow, we would delete the old draft
// For testing, we'll verify the deletion would work
test.assertDoesNotThrow(() => {
  activeDoc.delete();
}, 'Original draft can be deleted');

test.info('Original draft deleted successfully');
test.info('Conversion workflow completed');

// Summary
test.summary();
