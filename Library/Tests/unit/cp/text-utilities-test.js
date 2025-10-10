/**
 * TextUtilities Unit Test
 *
 * Tests the TextUtilities class in isolation.
 * This is a simple unit test demonstrating the new test pattern.
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");

// Load the module under test
require("modules/cp/utils/TextUtilities.js");

// Create test instance
const test = new TestAssertions('TextUtilities Unit Test');

// Load test data
const testData = createCPTestData();
const scenario = testData.getScenario('simpleTextUtilities');

test.section('Initialization');

// Test 1: Can instantiate TextUtilities
let textUtils;
test.assertDoesNotThrow(() => {
  textUtils = new TextUtilities();
}, 'TextUtilities instantiates without error');

test.assertNotNullish(textUtils, 'TextUtilities instance is not null');
test.assertType(textUtils, 'TextUtilities', 'Instance is of type TextUtilities');

test.section('capitalizeTags Method');

// Test 2: Capitalize tags with test data
const inputTags = scenario.inputTags;
const expectedTags = scenario.expectedTags;

let capitalizedTags;
test.assertDoesNotThrow(() => {
  capitalizedTags = textUtils.capitalizeTags(inputTags);
}, 'capitalizeTags executes without error');

test.assertType(capitalizedTags, 'Array', 'capitalizeTags returns an array');
test.assertEqual(capitalizedTags.length, expectedTags.length, 'Output array has correct length');

// Test 3: Verify each tag is capitalized correctly
test.section('Tag Capitalization Verification');

expectedTags.forEach((expectedTag, index) => {
  test.assertEqual(
    capitalizedTags[index],
    expectedTag,
    `Tag ${index}: "${inputTags[index]}" → "${expectedTag}"`
  );
});

// Test 4: Edge cases
test.section('Edge Cases');

test.assertDoesNotThrow(() => {
  const emptyResult = textUtils.capitalizeTags([]);
}, 'capitalizeTags handles empty array');

const emptyResult = textUtils.capitalizeTags([]);
test.assertEqual(emptyResult.length, 0, 'Empty array returns empty array');

// Test 5: Additional tag formats
test.section('Additional Tag Formats');

const additionalTests = [
  { input: ['lowercase'], expected: ['Lowercase'] },
  { input: ['UPPERCASE'], expected: ['UPPERCASE'] },
  { input: ['Mixed Case'], expected: ['Mixed Case'] },
  { input: ['multi word tag'], expected: ['Multi Word Tag'] },
];

additionalTests.forEach(({ input, expected }) => {
  const result = textUtils.capitalizeTags(input);
  test.assertEqual(
    result[0],
    expected[0],
    `"${input[0]}" → "${expected[0]}"`
  );
});

// Test 6: Input validation
test.section('Input Validation');

test.assertDoesNotThrow(() => {
  textUtils.capitalizeTags(['test']);
}, 'Accepts valid string array');

// Summary
test.summary();
