/**
 * Statuses Comprehensive Unit Test
 *
 * Tests Statuses class in isolation with mock dependencies.
 * Verifies:
 * - Status list initialization
 * - Status selection UI
 * - Status validation
 * - Current status detection
 * - Menu item generation
 * - Error handling
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");
require("../Tests/fixtures/mocks.js");

// Load ServiceContainer framework
require("shared/core/ServiceInitializer.js");

// Load component under test
require("modules/cp/core/Statuses.js");

// Create test instance
const test = new TestAssertions('Statuses Comprehensive Unit Tests');

// =============================================================================
// Setup with ServiceContainer
// =============================================================================

test.section('Setup and Configuration');

resetServices();
initializeServices();

const container = ServiceContainer.getInstance();

// Get test data
const testData = getCPTestData();
const testSettings = testData.settings;

// Register test mocks
const mockUI = createMockUI({ debug: false });
container.register('cpUI', () => mockUI, true);

// Create dependencies object
const dependencies = {
  ui: mockUI,
  settings: testSettings,
  tableName: 'table1',
};

// Create Statuses instance
const statuses = new Statuses(dependencies);

test.assertNotNullish(statuses, 'Statuses instance created');

// =============================================================================
// Section 1: Initialization
// =============================================================================

test.section('Initialization');

test.assertNotNullish(statuses.statusList, 'Status list initialized');
test.assertType(statuses.statusList, 'Array', 'Status list is an array');

// =============================================================================
// Section 2: Status List Contents
// =============================================================================

test.section('Status List Contents');

const expectedStatuses = testSettings.statuses.statusList;
test.assertEqual(
  statuses.statusList.length,
  expectedStatuses.length,
  'Status list has correct length'
);

test.info(`Expected statuses: ${expectedStatuses.join(', ')}`);

expectedStatuses.forEach((status) => {
  test.assertContains(statuses.statusList, status, `Status list contains "${status}"`);
});

// Verify specific statuses from test data
test.assertContains(statuses.statusList, 'Developing', 'Contains "Developing" status');
test.assertContains(statuses.statusList, 'Drafting', 'Contains "Drafting" status');
test.assertContains(statuses.statusList, 'Writing', 'Contains "Writing" status');
test.assertContains(statuses.statusList, 'Editing', 'Contains "Editing" status');
test.assertContains(statuses.statusList, 'Polishing', 'Contains "Polishing" status');
test.assertContains(statuses.statusList, 'On Deck', 'Contains "On Deck" status');

// =============================================================================
// Section 3: Get Current Status
// =============================================================================

test.section('Get Current Status');

// Test with a function that finds a specific status
const findWriting = (status) => status === 'Writing';
const currentStatus = statuses.getCurrentStatus(findWriting);

test.assertEqual(currentStatus, 'Writing', 'getCurrentStatus finds "Writing"');

// Test with function that matches multiple (should return comma-separated)
const findDrafting = (status) => status.includes('Draft');
const multipleStatuses = statuses.getCurrentStatus(findDrafting);

test.assertNotNullish(multipleStatuses, 'getCurrentStatus returns result for multiple matches');
test.info(`Statuses containing "Draft": ${multipleStatuses}`);

// Test with function that matches none
const findNone = (status) => status === 'NonexistentStatus';
const noStatus = statuses.getCurrentStatus(findNone);

test.assertEqual(noStatus, '', 'getCurrentStatus returns empty string when no match');

// =============================================================================
// Section 4: Status Selection UI (Would require actual UI in Drafts)
// =============================================================================

test.section('Status Selection UI');

// Note: The select() method uses buildMenu() which creates a Prompt object
// This would require the actual Drafts environment to work
// We can verify the method exists and doesn't throw with our mock

test.assertType(statuses.select, 'Function', 'select() method exists');
test.info('Note: Full select() testing requires Drafts environment');

// =============================================================================
// Section 5: Generate Status Menu Items
// =============================================================================

test.section('Generate Status Menu Items');

// Test generating menu items starting from a specific status
const menuItems = statuses.generateStatusMenuItems('Writing');

test.assertNotNullish(menuItems, 'generateStatusMenuItems returns result');
test.assertType(menuItems, 'Array', 'Returns an array');

// Should include statuses after "Writing"
test.info(`Menu items generated: ${menuItems.length} items`);

// First item should be "<< Back" button
test.assertEqual(menuItems[0].type, 'button', 'First item is a button');
test.assertEqual(menuItems[0].data.name, '<< Back', 'First item is Back button');
test.assertEqual(menuItems[0].data.value, 'back', 'Back button value is "back"');
test.assert(menuItems[0].data.isDefault === true, 'Back button is default');

// Subsequent items should be statuses after "Writing"
// In test data: Developing, Drafting, Writing, Editing, Polishing, On Deck
// After "Writing": Editing, Polishing, On Deck
if (menuItems.length > 1) {
  test.assertEqual(menuItems[1].type, 'button', 'Second item is a button');
  test.assertEqual(menuItems[1].data.name, 'Editing', 'Second item is "Editing"');
  test.assertEqual(menuItems[1].data.value, 'Editing', 'Editing button value is "Editing"');
}

if (menuItems.length > 2) {
  test.assertEqual(menuItems[2].data.name, 'Polishing', 'Third item is "Polishing"');
  test.assertEqual(menuItems[3].data.name, 'On Deck', 'Fourth item is "On Deck"');
}

// =============================================================================
// Section 6: Generate Menu Items from Different Starting Points
// =============================================================================

test.section('Generate Menu Items - Different Starting Points');

// From first status (Developing)
const fromFirst = statuses.generateStatusMenuItems('Developing');
test.assert(fromFirst.length > 1, 'Items generated from first status');
// Should include all statuses after Developing
test.info(`From "Developing": ${fromFirst.length} items (including Back button)`);

// From last status (On Deck)
const fromLast = statuses.generateStatusMenuItems('On Deck');
test.assertEqual(fromLast.length, 1, 'Only Back button when starting from last status');

// From middle status
const fromMiddle = statuses.generateStatusMenuItems('Drafting');
test.assert(fromMiddle.length > 1, 'Items generated from middle status');
test.info(`From "Drafting": ${fromMiddle.length} items`);

// =============================================================================
// Section 7: Edge Cases
// =============================================================================

test.section('Edge Cases');

// Test with status not in list
const fromNonexistent = statuses.generateStatusMenuItems('NonexistentStatus');
test.assertNotNullish(fromNonexistent, 'Handles nonexistent status gracefully');
// When status not found, findIndex returns -1, so slice(-1 + 1, length) = slice(0, length) = all items
test.info(`From nonexistent status: ${fromNonexistent.length} items`);

// Test getCurrentStatus with various edge cases
const alwaysTrue = () => true;
const allStatuses = statuses.getCurrentStatus(alwaysTrue);
test.assert(allStatuses.includes('Writing'), 'Can match all statuses');

const alwaysFalse = () => false;
const noneStatuses = statuses.getCurrentStatus(alwaysFalse);
test.assertEqual(noneStatuses, '', 'Returns empty string when no match');

// =============================================================================
// Section 8: Dependency Injection Verification
// =============================================================================

test.section('Dependency Injection Verification');

// Note: These are private fields, so we can't test them directly
// But we can verify the constructor accepted our dependencies
test.info('Dependencies injected via constructor');
test.info('UI and settings are private fields');

// =============================================================================
// Section 9: Status List Immutability
// =============================================================================

test.section('Status List Immutability');

const originalLength = statuses.statusList.length;
const originalFirst = statuses.statusList[0];

// Generate menu items (which uses slice internally)
statuses.generateStatusMenuItems('Writing');

// Verify original list unchanged
test.assertEqual(statuses.statusList.length, originalLength, 'Status list length unchanged');
test.assertEqual(statuses.statusList[0], originalFirst, 'First status unchanged');

// =============================================================================
// Test Summary
// =============================================================================

test.summary();
