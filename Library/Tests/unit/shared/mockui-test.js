/**
 * MockUI Comprehensive Unit Tests
 *
 * Tests MockUI functionality in isolation covering:
 * - Prompt display and interaction tracking
 * - Menu display and selection
 * - Error message handling
 * - Success message handling
 * - Interaction history
 * - Default values and selections
 * - Debug mode
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/mocks.js");

// Create test instance
const test = new TestAssertions('MockUI Comprehensive Tests');

// =============================================================================
// Section 1: MockUI Creation and Initialization
// =============================================================================

test.section('MockUI Creation and Initialization');

let mockUI;
test.assertDoesNotThrow(() => {
  mockUI = createMockUI({ debug: false });
}, 'Creating MockUI does not throw');

test.assertNotNullish(mockUI, 'MockUI instance created');
test.assertType(mockUI, 'MockUI', 'Is MockUI instance');

// Verify initial state
test.assert(mockUI.debug === false, 'Debug mode set correctly');
test.assertArrayLength(mockUI.interactions, 0, 'No interactions initially');

// =============================================================================
// Section 2: Display Prompt
// =============================================================================

test.section('Display Prompt');

const promptConfig = {
  title: 'Test Prompt',
  message: 'Please enter a value',
  defaultValue: 'default text'
};

let promptResult;
test.assertDoesNotThrow(() => {
  promptResult = mockUI.displayPrompt(promptConfig);
}, 'displayPrompt does not throw');

// Should return default value
test.assertEqual(promptResult, 'default text', 'Returns default value');

// Should track interaction
test.assertArrayLength(mockUI.interactions, 1, 'Interaction tracked');
test.assertEqual(mockUI.interactions[0].type, 'prompt', 'Interaction type is prompt');
test.assertEqual(mockUI.interactions[0].config.title, 'Test Prompt', 'Config captured');

// =============================================================================
// Section 3: Display Prompt Without Default
// =============================================================================

test.section('Display Prompt - No Default Value');

mockUI.clearInteractions();

const promptNoDefault = {
  title: 'No Default',
  message: 'Enter something'
};

const noDefaultResult = mockUI.displayPrompt(promptNoDefault);

test.assertNullish(noDefaultResult, 'Returns null when no default value');
test.assertArrayLength(mockUI.interactions, 1, 'Interaction tracked');

// =============================================================================
// Section 4: Display Error Message
// =============================================================================

test.section('Display Error Message');

mockUI.clearInteractions();

const errorConfig = {
  errorMessage: 'This is an error!'
};

test.assertDoesNotThrow(() => {
  mockUI.displayErrorMessage(errorConfig);
}, 'displayErrorMessage does not throw');

// Should track interaction
test.assertArrayLength(mockUI.interactions, 1, 'Error interaction tracked');
test.assertEqual(mockUI.interactions[0].type, 'error', 'Interaction type is error');
test.assertEqual(mockUI.interactions[0].config.errorMessage, 'This is an error!', 'Error message captured');

// =============================================================================
// Section 5: Display Success Message
// =============================================================================

test.section('Display Success Message');

mockUI.clearInteractions();

const successConfig = {
  successMessage: 'Operation successful!'
};

test.assertDoesNotThrow(() => {
  mockUI.displaySuccessMessage(successConfig);
}, 'displaySuccessMessage does not throw');

// Should track interaction
test.assertArrayLength(mockUI.interactions, 1, 'Success interaction tracked');
test.assertEqual(mockUI.interactions[0].type, 'success', 'Interaction type is success');
test.assertEqual(mockUI.interactions[0].config.successMessage, 'Operation successful!', 'Success message captured');

// =============================================================================
// Section 6: Display Menu with Default Selection
// =============================================================================

test.section('Display Menu - Default Selection');

mockUI.clearInteractions();

const menuConfig = {
  title: 'Select Option',
  defaultSelection: 'Option 2',
  options: ['Option 1', 'Option 2', 'Option 3']
};

let menuResult;
test.assertDoesNotThrow(() => {
  menuResult = mockUI.displayMenu(menuConfig);
}, 'displayMenu does not throw');

// Should return default selection
test.assertEqual(menuResult, 'Option 2', 'Returns default selection');

// Should track interaction
test.assertArrayLength(mockUI.interactions, 1, 'Menu interaction tracked');
test.assertEqual(mockUI.interactions[0].type, 'menu', 'Interaction type is menu');
test.assertEqual(mockUI.interactions[0].config.title, 'Select Option', 'Menu title captured');

// =============================================================================
// Section 7: Display Menu Without Default (First Option)
// =============================================================================

test.section('Display Menu - No Default (First Option)');

mockUI.clearInteractions();

const menuNoDefault = {
  title: 'Choose One',
  options: ['First', 'Second', 'Third']
};

const menuNoDefaultResult = mockUI.displayMenu(menuNoDefault);

test.assertEqual(menuNoDefaultResult, 'First', 'Returns first option when no default');

// =============================================================================
// Section 8: Get Interactions by Type
// =============================================================================

test.section('Get Interactions by Type');

mockUI.clearInteractions();

// Create multiple interactions of different types
mockUI.displayPrompt({ title: 'Prompt 1' });
mockUI.displayErrorMessage({ errorMessage: 'Error 1' });
mockUI.displayPrompt({ title: 'Prompt 2' });
mockUI.displaySuccessMessage({ successMessage: 'Success 1' });
mockUI.displayMenu({ title: 'Menu 1', options: ['A', 'B'] });
mockUI.displayErrorMessage({ errorMessage: 'Error 2' });

// Total should be 6
test.assertArrayLength(mockUI.interactions, 6, 'All interactions tracked');

// Filter by type
const promptInteractions = mockUI.getInteractionsByType('prompt');
test.assertArrayLength(promptInteractions, 2, 'Two prompt interactions');

const errorInteractions = mockUI.getInteractionsByType('error');
test.assertArrayLength(errorInteractions, 2, 'Two error interactions');

const successInteractions = mockUI.getInteractionsByType('success');
test.assertArrayLength(successInteractions, 1, 'One success interaction');

const menuInteractions = mockUI.getInteractionsByType('menu');
test.assertArrayLength(menuInteractions, 1, 'One menu interaction');

// =============================================================================
// Section 9: Clear Interactions
// =============================================================================

test.section('Clear Interactions');

// Should have 6 interactions from previous test
test.assert(mockUI.interactions.length > 0, 'Has interactions before clear');

mockUI.clearInteractions();

test.assertArrayLength(mockUI.interactions, 0, 'Interactions cleared');

// New interactions should still be tracked
mockUI.displayPrompt({ title: 'After Clear' });
test.assertArrayLength(mockUI.interactions, 1, 'New interactions tracked after clear');

// =============================================================================
// Section 10: Debug Mode
// =============================================================================

test.section('Debug Mode');

// Create MockUI with debug enabled
const debugUI = createMockUI({ debug: true });

test.assert(debugUI.debug === true, 'Debug mode enabled');

// Note: Debug mode outputs to console.log, which we can't easily test
// Just verify it doesn't break functionality
test.assertDoesNotThrow(() => {
  debugUI.displayPrompt({ title: 'Debug Prompt' });
  debugUI.displayErrorMessage({ errorMessage: 'Debug Error' });
  debugUI.displaySuccessMessage({ successMessage: 'Debug Success' });
  debugUI.displayMenu({ title: 'Debug Menu', options: ['A', 'B'] });
}, 'Debug mode does not break functionality');

test.assertArrayLength(debugUI.interactions, 4, 'Debug mode tracks interactions');

// =============================================================================
// Section 11: Multiple MockUI Instances
// =============================================================================

test.section('Multiple MockUI Instances');

const ui1 = createMockUI({ debug: false });
const ui2 = createMockUI({ debug: true });

ui1.displayPrompt({ title: 'UI1 Prompt' });
ui2.displayPrompt({ title: 'UI2 Prompt' });

// Each should have independent interaction history
test.assertArrayLength(ui1.interactions, 1, 'UI1 has 1 interaction');
test.assertArrayLength(ui2.interactions, 1, 'UI2 has 1 interaction');

test.assertEqual(ui1.interactions[0].config.title, 'UI1 Prompt', 'UI1 interaction is separate');
test.assertEqual(ui2.interactions[0].config.title, 'UI2 Prompt', 'UI2 interaction is separate');

// =============================================================================
// Section 12: Complex Menu Configuration
// =============================================================================

test.section('Complex Menu Configuration');

mockUI.clearInteractions();

const complexMenu = {
  title: 'Complex Menu',
  message: 'Choose wisely',
  defaultSelection: 'Medium',
  options: ['Small', 'Medium', 'Large', 'Extra Large'],
  isCancellable: true
};

const complexResult = mockUI.displayMenu(complexMenu);

test.assertEqual(complexResult, 'Medium', 'Complex menu returns default selection');

const menuInteraction = mockUI.interactions[0];
test.assertEqual(menuInteraction.config.title, 'Complex Menu', 'Title preserved');
test.assertEqual(menuInteraction.config.message, 'Choose wisely', 'Message preserved');
test.assert(menuInteraction.config.isCancellable === true, 'isCancellable preserved');
test.assertArrayLength(menuInteraction.config.options, 4, 'All options preserved');

// =============================================================================
// Section 13: Edge Cases - Empty Configurations
// =============================================================================

test.section('Edge Cases - Empty Configurations');

mockUI.clearInteractions();

// Empty prompt config
test.assertDoesNotThrow(() => {
  const emptyPrompt = mockUI.displayPrompt({});
  test.assertNullish(emptyPrompt, 'Empty prompt config returns null');
}, 'Empty prompt config handled');

// Empty error config
test.assertDoesNotThrow(() => {
  mockUI.displayErrorMessage({});
}, 'Empty error config handled');

// Empty success config
test.assertDoesNotThrow(() => {
  mockUI.displaySuccessMessage({});
}, 'Empty success config handled');

// Menu with empty options array
test.assertDoesNotThrow(() => {
  const emptyMenu = mockUI.displayMenu({ options: [] });
  test.assertNullish(emptyMenu, 'Menu with empty options returns undefined');
}, 'Empty menu options handled');

// =============================================================================
// Section 14: Interaction Data Integrity
// =============================================================================

test.section('Interaction Data Integrity');

mockUI.clearInteractions();

const testConfig = {
  title: 'Data Test',
  extra: { key: 'value' }
};

mockUI.displayPrompt(testConfig);

// Verify the captured config contains all data
const capturedConfig = mockUI.interactions[0].config;
test.assertEqual(capturedConfig.title, 'Data Test', 'Title captured');
test.assertNotNullish(capturedConfig.extra, 'Extra data captured');
test.assertEqual(capturedConfig.extra.key, 'value', 'Nested data captured');

// =============================================================================
// Section 15: MockUI with defaultMenuSelection
// =============================================================================

test.section('MockUI with defaultMenuSelection Property');

const uiWithDefault = createMockUI({ debug: false });
uiWithDefault.defaultMenuSelection = 'Custom Default';

// When displayMenu is called, it uses config.defaultSelection
// But we can set a property on mockUI for testing purposes
test.info('Custom default selection property can be set');

// =============================================================================
// Section 16: Verify No Side Effects
// =============================================================================

test.section('Verify No Side Effects');

// MockUI should not modify passed configurations
const originalConfig = {
  title: 'Original',
  options: ['A', 'B', 'C']
};

const configCopy = JSON.parse(JSON.stringify(originalConfig));

mockUI.displayMenu(originalConfig);

// Original should be unchanged
test.assertEqual(JSON.stringify(originalConfig), JSON.stringify(configCopy), 'Config not modified');

// =============================================================================
// Section 17: Interaction Order
// =============================================================================

test.section('Interaction Order');

mockUI.clearInteractions();

mockUI.displayPrompt({ title: 'First' });
mockUI.displayErrorMessage({ errorMessage: 'Second' });
mockUI.displaySuccessMessage({ successMessage: 'Third' });

test.assertEqual(mockUI.interactions[0].type, 'prompt', 'First interaction is prompt');
test.assertEqual(mockUI.interactions[1].type, 'error', 'Second interaction is error');
test.assertEqual(mockUI.interactions[2].type, 'success', 'Third interaction is success');

test.assertEqual(mockUI.interactions[0].config.title, 'First', 'Order preserved');
test.assertEqual(mockUI.interactions[1].config.errorMessage, 'Second', 'Order preserved');
test.assertEqual(mockUI.interactions[2].config.successMessage, 'Third', 'Order preserved');

// =============================================================================
// Test Summary
// =============================================================================

test.summary();
