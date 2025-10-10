/**
 * Statuses Unit Test
 *
 * Tests Statuses class in isolation with mock dependencies.
 * Verifies:
 * - Status list initialization
 * - Status selection UI
 * - Status validation
 * - Error handling
 */

// Load test infrastructure
require("../../fixtures/assertions.js");
require("../../fixtures/testData.js");
require("../../fixtures/mocks.js");

// Load ServiceContainer framework
require("shared/core/ServiceInitializer.js");

// Load component under test
require("modules/cp/core/Statuses.js");

// Create test instance
const test = new TestAssertions('Statuses Unit Tests');

// Setup with ServiceContainer
resetServices();
initializeServices();

const container = ServiceContainer.getInstance();

// Get test data
const testDataHelper = createCPTestData();
const testSettings = testDataHelper.getSettings();

// Register test mocks
const mockUI = createMockUI({ debug: true });
container.register('cpUI', () => mockUI, true);

// Create dependencies object
const dependencies = {
  ui: mockUI,
  settings: testSettings,
  tableName: 'table1',
};

// Create Statuses instance
const statuses = new Statuses(dependencies);

// Test Section: Initialization
test.section('Initialization');

test.assertNotNullish(statuses, 'Statuses instance created');
test.assertNotNullish(statuses.list, 'Status list initialized');
test.assertType(statuses.list, 'Array', 'Status list is an array');

// Test Section: Status List Contents
test.section('Status List Contents');

const expectedStatuses = testSettings.statuses.statusList;
test.assertEqual(
  statuses.list.length,
  expectedStatuses.length,
  'Status list has correct length'
);

test.info(`Expected statuses: ${expectedStatuses.join(', ')}`);

expectedStatuses.forEach((status) => {
  test.assertIncludes(statuses.list, status, `Status list contains "${status}"`);
});

// Test Section: Status Validation
test.section('Status Validation');

test.assert(
  statuses.isValid('Writing'),
  'Recognizes valid status "Writing"'
);

test.assert(
  statuses.isValid('Editing'),
  'Recognizes valid status "Editing"'
);

test.assertFalsy(
  statuses.isValid('InvalidStatus'),
  'Rejects invalid status'
);

test.assertFalsy(
  statuses.isValid(null),
  'Rejects null status'
);

test.assertFalsy(
  statuses.isValid(''),
  'Rejects empty string status'
);

// Test Section: Status Selection UI
test.section('Status Selection UI');

// Configure mock UI to return a specific status
mockUI.setPromptResponse('Chose Status:', 'Writing');

const selectedStatus = statuses.select();

test.assertEqual(
  selectedStatus,
  'Writing',
  'select() returns user-selected status'
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
  'Chose Status:',
  'Prompt has correct title'
);

// Test Section: Error Handling
test.section('Error Handling');

// Test with no UI response (cancelled)
mockUI.clearInteractions();
mockUI.setPromptResponse('Chose Status:', null);

const cancelledStatus = statuses.select();

test.assertNullish(
  cancelledStatus,
  'select() returns null when cancelled'
);

// Test Section: Properties
test.section('Properties');

test.assertNotNullish(
  statuses.errorMessage,
  'Has error message defined'
);

test.assertType(
  statuses.errorMessage,
  'string',
  'Error message is a string'
);

test.info(`Error message: "${statuses.errorMessage}"`);

// Test Section: Dependency Injection
test.section('Dependency Injection');

test.assertNotNullish(statuses.ui, 'Has UI dependency');
test.assertNotNullish(statuses.settings, 'Has settings dependency');
test.assertEqual(
  statuses.ui,
  mockUI,
  'UI dependency is the injected mock'
);

test.summary();
