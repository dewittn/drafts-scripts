/**
 * Destinations Comprehensive Unit Test
 *
 * Tests Destinations class in isolation with mock dependencies.
 * Verifies:
 * - Destinations list initialization from file system
 * - Destination selection UI
 * - Destination lookup methods
 * - Key validation
 * - Airtable destination mapping
 * - Template and action lookup
 * - Error handling
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");
require("../Tests/fixtures/mocks.js");

// Load ServiceContainer framework
require("shared/core/ServiceInitializer.js");

// Load component under test
require("modules/cp/core/Destinations.js");

// Create test instance
const test = new TestAssertions('Destinations Comprehensive Unit Tests');

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
const destinationsData = testData.destinations;

// Register test mocks
const mockUI = createMockUI({ debug: false });
const mockFS = createMockFS(testData);
container.register('cpUI', () => mockUI, true);
container.register('cpFileSystem', () => mockFS, true);

// Get services
const contentPipeline = container.get('cpDefault');
const destinations = contentPipeline.destinations;

test.assertNotNullish(destinations, 'Destinations instance created');

// =============================================================================
// Section 1: Initialization
// =============================================================================

test.section('Initialization');

test.assertNotNullish(destinations.data, 'Destinations data initialized');
test.assertType(destinations.data, 'Object', 'Destinations data is an object');

test.assertNotNullish(destinations.keys, 'Destinations keys initialized');
test.assertType(destinations.keys, 'Array', 'Destinations keys is an array');

// =============================================================================
// Section 2: Destinations Keys Contents
// =============================================================================

test.section('Destinations Keys Contents');

const keys = destinations.keys;

test.assert(keys.length > 0, 'Has destination keys');
test.info(`Found ${keys.length} destinations`);
test.info(`Destinations: ${keys.join(', ')}`);

// Verify specific test destinations exist (excluding 'inbox')
const expectedDests = Object.keys(destinationsData.table1).filter(key => key !== 'inbox');

test.assert(keys.length >= expectedDests.length, 'Has all expected destinations');

expectedDests.forEach((destName) => {
  test.assertContains(keys, destName, `Destinations contains "${destName}"`);
});

// Verify specific destinations from test data
test.assertContains(keys, 'Test Newsletter', 'Contains "Test Newsletter"');
test.assertContains(keys, 'Test Blog', 'Contains "Test Blog"');
test.assertContains(keys, 'Test Studio', 'Contains "Test Studio"');

// =============================================================================
// Section 3: Key Validation
// =============================================================================

test.section('Key Validation');

// Valid keys
test.assert(destinations.isValidKey('Test Blog'), '"Test Blog" is valid');
test.assert(destinations.isValidKey('Test Newsletter'), '"Test Newsletter" is valid');
test.assert(destinations.isValidKey('Test Studio'), '"Test Studio" is valid');

// Invalid keys
test.assert(!destinations.isValidKey('InvalidDestination'), 'Rejects invalid destination');
test.assert(!destinations.isValidKey(''), 'Rejects empty string');
test.assert(!destinations.isValidKey(null), 'Rejects null');
test.assert(!destinations.isValidKey(undefined), 'Rejects undefined');

// =============================================================================
// Section 4: Get Current Destination
// =============================================================================

test.section('Get Current Destination');

// Test with function that finds specific destination
const findBlog = (dest) => dest === 'Test Blog';
const currentDest = destinations.getCurrentDestination(findBlog);

test.assertEqual(currentDest, 'Test Blog', 'getCurrentDestination finds "Test Blog"');

// Test with function that matches multiple
const findTest = (dest) => dest.includes('Test');
const multipleFirst = destinations.getCurrentDestination(findTest);

test.assertNotNullish(multipleFirst, 'getCurrentDestination returns result for multiple matches');
test.info(`Destinations containing "Test": ${multipleFirst}`);

// Test with function that matches none
const findNone = (dest) => dest === 'NonexistentDest';
const noDest = destinations.getCurrentDestination(findNone);

test.assertEqual(noDest, '', 'getCurrentDestination returns empty string when no match');

// =============================================================================
// Section 5: Lookup Group ID
// =============================================================================

test.section('Lookup Group ID');

const blogGroupID = destinations.lookupGroupID('Test Blog');
test.assertNotNullish(blogGroupID, '"Test Blog" has groupID');
test.assertEqual(blogGroupID, 'TEST-BLOG-ID-001', 'Correct groupID returned');

const newsletterGroupID = destinations.lookupGroupID('Test Newsletter');
test.assertNotNullish(newsletterGroupID, '"Test Newsletter" has groupID');
test.assertEqual(newsletterGroupID, 'TEST-NEWSLETTER-ID-001', 'Correct newsletter groupID');

// Invalid destination
const invalidGroupID = destinations.lookupGroupID('InvalidDest');
test.assertNullish(invalidGroupID, 'Invalid destination returns undefined for groupID');

// =============================================================================
// Section 6: Lookup Template
// =============================================================================

test.section('Lookup Template');

const blogTemplate = destinations.lookupTemplate('Test Blog');
test.assertNotNullish(blogTemplate, '"Test Blog" has template');
test.assertEqual(blogTemplate, 'blogPost', 'Correct template returned');

const newsletterTemplate = destinations.lookupTemplate('Test Newsletter');
test.assertNotNullish(newsletterTemplate, '"Test Newsletter" has template');
test.assertEqual(newsletterTemplate, 'newsletter', 'Correct newsletter template');

// Destination without template
const studioTemplate = destinations.lookupTemplate('Test Studio');
test.assertNullish(studioTemplate, '"Test Studio" has no template (returns undefined)');

// Invalid destination
const invalidTemplate = destinations.lookupTemplate('InvalidDest');
test.assertNullish(invalidTemplate, 'Invalid destination returns undefined for template');

// =============================================================================
// Section 7: Lookup Draft Action
// =============================================================================

test.section('Lookup Draft Action');

const newsletterAction = destinations.lookupAction('Test Newsletter');
test.assertNotNullish(newsletterAction, '"Test Newsletter" has action');
test.assertEqual(newsletterAction, 'Show Alert', 'Correct action returned');

// Destination without action
const blogAction = destinations.lookupAction('Test Blog');
test.assertNullish(blogAction, '"Test Blog" has no action (returns undefined)');

// Invalid destination
const invalidAction = destinations.lookupAction('InvalidDest');
test.assertNullish(invalidAction, 'Invalid destination returns undefined for action');

// =============================================================================
// Section 8: Lookup Airtable Destination Name
// =============================================================================

test.section('Lookup Airtable Destination Name');

const blogAirtable = destinations.lookupAirTableDestinationName('Test Blog');
test.assertNotNullish(blogAirtable, '"Test Blog" has Airtable name');
test.assertEqual(blogAirtable, 'Blog.Posts', 'Correct Airtable name returned');

const newsletterAirtable = destinations.lookupAirTableDestinationName('Test Newsletter');
test.assertNotNullish(newsletterAirtable, '"Test Newsletter" has Airtable name');
test.assertEqual(newsletterAirtable, 'Newsletter', 'Correct newsletter Airtable name');

// Destination without airtableName - should return title-cased destination name
const studioAirtable = destinations.lookupAirTableDestinationName('Test Studio');
test.assertNotNullish(studioAirtable, '"Test Studio" returns title-cased name');
test.assertEqual(studioAirtable, 'Coto.Studio', 'Uses airtableName from test data');

// =============================================================================
// Section 9: Get Scrub Text
// =============================================================================

test.section('Get Scrub Text');

const blogScrubText = destinations.getScrubText('Test Blog');
test.assertNotNullish(blogScrubText, '"Test Blog" has scrub text');
test.assertEqual(blogScrubText, 'Blog: ', 'Correct scrub text returned');

// Destination without scrubText
const newsletterScrubText = destinations.getScrubText('Test Newsletter');
test.assertNullish(newsletterScrubText, '"Test Newsletter" has no scrub text (returns undefined)');

// Invalid destination
const invalidScrubText = destinations.getScrubText('InvalidDest');
test.assertNullish(invalidScrubText, 'Invalid destination returns undefined for scrub text');

// =============================================================================
// Section 10: Get Info From Key
// =============================================================================

test.section('Get Info From Key');

const blogInfo = destinations.getInfoFromKey('Test Blog');
test.assertNotNullish(blogInfo, '"Test Blog" returns info');
test.assertType(blogInfo, 'Object', 'Info is an object');
test.assertNotNullish(blogInfo.groupID, 'Info contains groupID');
test.assertEqual(blogInfo.groupID, 'TEST-BLOG-ID-001', 'Correct groupID in info');

// Invalid destination - should return default object
const invalidInfo = destinations.getInfoFromKey('InvalidDest');
test.assertNotNullish(invalidInfo, 'Invalid destination returns default info');
test.assertNullish(invalidInfo.groupID, 'Invalid destination info has null groupID');

// =============================================================================
// Section 11: Lookup Document Conversion Data
// =============================================================================

test.section('Lookup Document Conversion Data');

// Test with various destinations and statuses
const conversionData = destinations.lookupDocConvertionData('Test Blog', 'Publishing');
test.assertNotNullish(conversionData, 'Returns conversion data');
test.assertType(conversionData, 'Object', 'Conversion data is an object');

// Has expected properties
test.assert('covertDoc' in conversionData, 'Has covertDoc property');
test.assert('newDocType' in conversionData, 'Has newDocType property');

test.info('Conversion data structure verified');

// =============================================================================
// Section 12: Data Access
// =============================================================================

test.section('Data Access');

const data = destinations.data;
test.assertNotNullish(data, 'Can access data');
test.assertType(data, 'Object', 'Data is an object');

// Verify specific destinations in data
test.assertNotNullish(data['Test Blog'], 'Test Blog in data');
test.assertNotNullish(data['Test Newsletter'], 'Test Newsletter in data');
test.assertNotNullish(data['Test Studio'], 'Test Studio in data');

// Verify inbox exists
test.assertNotNullish(data['inbox'], 'Inbox exists in data');
test.assertNotNullish(data['inbox'].groupID, 'Inbox has groupID');

// =============================================================================
// Section 13: Keys Array Verification
// =============================================================================

test.section('Keys Array Verification');

const keysArray = destinations.keys;

// Keys should not include 'inbox' typically (depends on implementation)
test.assertType(keysArray, 'Array', 'Keys is an array');
test.assert(keysArray.length > 0, 'Keys array not empty');

// Each key should be valid
keysArray.forEach((key) => {
  test.assert(destinations.isValidKey(key), `Key "${key}" is valid`);
});

// =============================================================================
// Section 14: Edge Cases
// =============================================================================

test.section('Edge Cases');

// Test with case sensitivity
const lowerCaseLookup = destinations.lookupAirTableDestinationName('test blog');
test.info(`Lowercase "test blog" lookup: ${lowerCaseLookup || 'undefined'}`);
// Note: The method uses .toLowerCase() internally

// Test getCurrentDestination with edge cases
const alwaysTrue = () => true;
const allDests = destinations.getCurrentDestination(alwaysTrue);
test.assert(allDests.includes('Test Blog'), 'Can match all destinations');

const alwaysFalse = () => false;
const noneDests = destinations.getCurrentDestination(alwaysFalse);
test.assertEqual(noneDests, '', 'Returns empty string when no match');

// =============================================================================
// Section 15: Selection Method Exists
// =============================================================================

test.section('Selection Method');

// Note: The select() method uses buildMenu() which creates a Prompt object
// This would require the actual Drafts environment to work
test.assertType(destinations.select, 'Function', 'select() method exists');
test.info('Note: Full select() testing requires Drafts environment');

// =============================================================================
// Test Summary
// =============================================================================

test.summary();
