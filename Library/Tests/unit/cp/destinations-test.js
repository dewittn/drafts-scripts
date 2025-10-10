/**
 * Destinations Unit Test
 *
 * Tests Destinations class in isolation with mock dependencies.
 * Verifies:
 * - Destinations list initialization from file system
 * - Destination selection UI
 * - Destination lookup by name
 * - Error handling
 */

// Load test infrastructure
require("../../fixtures/assertions.js");
require("../../fixtures/testData.js");
require("../../fixtures/mocks.js");

// Load ServiceContainer framework
require("shared/core/ServiceInitializer.js");

// Load component under test
require("modules/cp/core/Destinations.js");

// Create test instance
const test = new TestAssertions('Destinations Unit Tests');

// Setup with ServiceContainer
resetServices();
initializeServices();

const container = ServiceContainer.getInstance();

// Get test data
const testDataHelper = createCPTestData();
const testSettings = testDataHelper.getSettings();
const testDestinations = testDataHelper.getDestinationsData('table1');

// Register test mocks
const mockUI = createMockUI({ debug: true });
const mockFS = createMockFileSystem({
  '/Library/Data/cp/destinations.json': JSON.stringify({
    table1: testDestinations
  })
}, { debug: true });

container.register('cpUI', () => mockUI, true);
container.register('cpFileSystem', () => mockFS, true);

// Create dependencies object
const dependencies = {
  ui: mockUI,
  fileSystem: mockFS,
  settings: testSettings,
  tableName: 'table1',
};

// Create Destinations instance
const destinations = new Destinations(dependencies);

// Test Section: Initialization
test.section('Initialization');

test.assertNotNullish(destinations, 'Destinations instance created');
test.assertNotNullish(destinations.destinationsList, 'Destinations list initialized');
test.assertType(destinations.destinationsList, 'Array', 'Destinations list is an array');

// Test Section: Destinations List Contents
test.section('Destinations List Contents');

test.assert(
  destinations.destinationsList.length > 0,
  'Destinations list is not empty'
);

test.info(`Found ${destinations.destinationsList.length} destinations`);
test.info(`Destinations: ${destinations.destinationsList.join(', ')}`);

// Verify specific test destinations exist
const expectedDestinations = Object.keys(testDestinations).filter(key => key !== 'inbox');

expectedDestinations.forEach((destName) => {
  test.assertIncludes(
    destinations.destinationsList,
    destName,
    `Destinations list contains "${destName}"`
  );
});

// Test Section: Destination Lookup
test.section('Destination Lookup');

// Test getting destination by name
const firstDest = destinations.destinationsList[0];
const destData = destinations.getDestination(firstDest);

test.assertNotNullish(destData, `Can retrieve destination "${firstDest}"`);
test.assertNotNullish(destData.groupID, 'Destination has groupID');

test.info(`Destination "${firstDest}" groupID: ${destData.groupID}`);

// Test getting inbox
const inbox = destinations.getInbox();
test.assertNotNullish(inbox, 'Can retrieve inbox');
test.assertNotNullish(inbox.groupID, 'Inbox has groupID');

test.info(`Inbox groupID: ${inbox.groupID}`);

// Test invalid destination
const invalidDest = destinations.getDestination('NonexistentDestination');
test.assertNullish(invalidDest, 'Returns null for invalid destination');

// Test Section: Destination Selection UI
test.section('Destination Selection UI');

// Configure mock UI to return a specific destination
const testDestName = destinations.destinationsList[0];
mockUI.setPromptResponse('Chose destination:', testDestName);

const selectedDest = destinations.select();

test.assertEqual(
  selectedDest,
  testDestName,
  'select() returns user-selected destination'
);

// Verify UI interaction occurred
const promptInteractions = mockUI.getInteractionsByType('prompt');
test.assertEqual(
  promptInteractions.length,
  1,
  'One prompt interaction occurred'
);

test.assertEqual(
  promptInteractions[0].config.menuTitle,
  'Chose destination:',
  'Prompt has correct title'
);

// Test Section: Error Handling
test.section('Error Handling');

// Test with no UI response (cancelled)
mockUI.clearInteractions();
mockUI.setPromptResponse('Chose destination:', null);

const cancelledDest = destinations.select();

test.assertNullish(
  cancelledDest,
  'select() returns null when cancelled'
);

// Test Section: Properties
test.section('Properties');

test.assertNotNullish(
  destinations.errorMessage,
  'Has error message defined'
);

test.assertType(
  destinations.errorMessage,
  'string',
  'Error message is a string'
);

test.info(`Error message: "${destinations.errorMessage}"`);

// Test Section: Dependency Injection
test.section('Dependency Injection');

test.assertNotNullish(destinations.ui, 'Has UI dependency');
test.assertNotNullish(destinations.fileSystem, 'Has fileSystem dependency');
test.assertNotNullish(destinations.settings, 'Has settings dependency');

test.assertEqual(
  destinations.ui,
  mockUI,
  'UI dependency is the injected mock'
);

test.assertEqual(
  destinations.fileSystem,
  mockFS,
  'FileSystem dependency is the injected mock'
);

// Test Section: File System Integration
test.section('File System Integration');

const fsOps = mockFS.getOperationsByType('read');
test.assert(
  fsOps.length > 0,
  'FileSystem was queried during initialization'
);

test.info(`FileSystem read operations: ${fsOps.length}`);

test.summary();
