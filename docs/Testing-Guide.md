# Test Suite Documentation

This directory contains the test suite for the Drafts Scripts project. Tests are organized using a ServiceContainer-based architecture with standardized test data and assertion helpers.

## Directory Structure

```
Library/Tests/
├── unit/                           # Unit tests (test individual components)
│   ├── cp/                         # Content Pipeline unit tests
│   ├── bvr/                        # BVR unit tests
│   └── shared/                     # Shared utilities unit tests
├── integration/                    # Integration tests (test workflows)
│   ├── cp/                         # Content Pipeline integration tests
│   └── bvr/                        # BVR integration tests
├── fixtures/                       # Test infrastructure
│   ├── assertions.js               # Test assertion helpers
│   ├── mocks.js                    # Mock service implementations
│   └── testData.js                 # Test data loader
└── README.md                       # This file
```

## Test Infrastructure

### Assertions (`fixtures/assertions.js`)

The `TestAssertions` class provides a simple assertion framework for console-based testing:

```javascript
// All require() paths are relative to Library/Scripts/ base
require("../Tests/fixtures/assertions.js");

const test = new TestAssertions('My Test Suite');

// Basic assertions
test.assert(condition, 'Description');
test.assertEqual(actual, expected, 'Description');
test.assertDeepEqual(obj1, obj2, 'Description');
test.assertTruthy(value, 'Description');
test.assertThrows(() => { /* code */ }, 'Description');

// Organize tests into sections
test.section('Section Name');

// Complete the test (throws if any failed)
test.summary();
```

**Available assertions:**
- `assert(condition, message)` - Basic boolean assertion
- `assertEqual(actual, expected, message)` - Strict equality (===)
- `assertDeepEqual(actual, expected, message)` - Deep equality (via JSON)
- `assertTruthy(value, message)` - Truthy check
- `assertFalsy(value, message)` - Falsy check
- `assertThrows(fn, message, [expectedError])` - Function throws error
- `assertDoesNotThrow(fn, message)` - Function executes without error
- `assertNullish(value, message)` - Value is null or undefined
- `assertNotNullish(value, message)` - Value is not null or undefined
- `assertIncludes(array, value, message)` - Array contains value
- `assertHasProperty(obj, property, message)` - Object has property
- `assertType(value, type, message)` - Type checking

### Mock Services (`fixtures/mocks.js`)

Mock implementations for testing in isolation:

**MockUI:**
```javascript
const mockUI = createMockUI({ debug: true });
mockUI.setPromptResponse('Prompt Title', 'response value');

// Track interactions
const interactions = mockUI.getInteractions();
const errors = mockUI.getInteractionsByType('error');
```

**MockDatabase:**
```javascript
const mockDB = createMockDatabase(testRecords, { debug: true });
mockDB.setShouldFail(true); // Simulate failures

// Track queries
const queries = mockDB.getQueries();
const updates = mockDB.getQueriesByType('update');
```

**MockFileSystem:**
```javascript
const mockFS = createMockFileSystem(testData, { debug: true });

// Track operations
const operations = mockFS.getOperations();
const writes = mockFS.getOperationsByType('write');
```

### Test Data (`fixtures/testData.js`)

Test data is defined in YAML files at `Library/Data/tests/` and compiled to JSON at build time.

**Load test data:**
```javascript
// All require() paths are relative to Library/Scripts/ base
require("../Tests/fixtures/testData.js");

const testData = createCPTestData();

// Get settings
const settings = testData.getSettings();

// Get destinations
const destinations = testData.getDestinationsData('table1');

// Get mock records
const record = testData.getMockRecord('TEST-DRAFT-UUID-001');
const allRecords = testData.getAllMockRecords();

// Get test scenarios
const scenario = testData.getScenario('simpleTextUtilities');
```

**Quick access functions:**
```javascript
const settings = getCPTestSettings();
const destinations = getCPTestDestinations('table1');
const mockRecords = getCPTestMockRecords();
```

## Writing Tests

### Unit Test Pattern

Unit tests focus on testing individual classes or functions in isolation:

```javascript
// All require() paths are relative to Library/Scripts/ base

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");

// Load module under test
require("modules/cp/utils/TextUtilities.js");

// Create test instance
const test = new TestAssertions('TextUtilities Unit Test');

// Load test data
const testData = createCPTestData();
const scenario = testData.getScenario('simpleTextUtilities');

// Test sections
test.section('Initialization');

let textUtils;
test.assertDoesNotThrow(() => {
  textUtils = new TextUtilities();
}, 'TextUtilities instantiates without error');

test.section('capitalizeTags Method');

const result = textUtils.capitalizeTags(scenario.inputTags);
test.assertEqual(result.length, scenario.expectedTags.length, 'Output length matches');

// Summary (throws if any test failed)
test.summary();
```

### Integration Test Pattern

Integration tests verify complete workflows using ServiceContainer:

```javascript
// All require() paths are relative to Library/Scripts/ base

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");
require("../Tests/fixtures/mocks.js");

// Load ServiceContainer framework
require("shared/core/ServiceInitializer.js");

// Load required modules
require("modules/cp/core/ContentPipeline.js");
// ... other modules

// Create test instance
const test = new TestAssertions('Workflow Integration Test');

// Setup: Load test data
const testData = createCPTestData();
const settings = testData.getSettingsCopy();

// Reset and configure ServiceContainer
const container = ServiceContainer.getInstance();
container.reset();

// Create and register mock services
const mockUI = createMockUI({ debug: true });
const mockFS = new TestFS({ table1: destinationsData });

const dependencies = {
  ui: mockUI,
  fileSystem: mockFS,
  settings: settings,
  // ... other dependencies
};

// Initialize services
const statuses = new Statuses(dependencies);
const destinations = new Destinations(dependencies);
const documentFactory = new DocumentFactory(dependencies);

// Run workflow tests
test.section('Workflow Step 1');
// ... test code

test.section('Workflow Step 2');
// ... test code

// Summary
test.summary();
```

## Test Data Management

Test data lives in `Library/Data/tests/` as YAML files:

```yaml
# cp-test-data.yaml

settings:
  defaultTag: "In Pipeline"
  statuses:
    statusList:
      - Developing
      - Writing

destinations:
  table1:
    inbox:
      groupID: "TEST-INBOX-ID"

mockRecords:
  - id: "recTEST001"
    docID: "TEST-DRAFT-UUID-001"
    Title: "Test Draft 1"
    Status: "Writing"

scenarios:
  simpleTextUtilities:
    inputTags: ["test1", "test2"]
    expectedTags: ["Test1", "Test2"]
```

**Build process:**
1. Edit YAML files in `Library/Data/tests/`
2. Run `npm run sync` or `gulp yaml2json`
3. YAML files are compiled to JSON
4. Tests load JSON at runtime via `testData.js`

## Running Tests

### In Drafts (Primary Method)

Tests are run as Drafts actions. Create wrapper actions in `Library/Scripts/cp/tests/`:

```javascript
// Library/Scripts/cp/tests/run-text-utilities-test.js
// All require() paths are relative to Library/Scripts/ base
require("../Tests/unit/cp/text-utilities-test.js");
```

Then create a Drafts action that runs this script.

### Test Execution Flow

1. Test loads infrastructure and dependencies
2. Test configures services and test data
3. Test runs assertions organized in sections
4. Test calls `test.summary()` which:
   - Prints summary statistics
   - Throws error if any test failed
   - Logs all failures to console

### Viewing Results

All output appears in the Drafts console log:
- ✅ indicates passed test
- ❌ indicates failed test
- ℹ️ indicates informational message
- Test summary shows pass/fail counts

## Test Organization Guidelines

### Unit Tests (`unit/`)

- Test individual classes/functions in isolation
- Mock external dependencies
- Focus on public API of the module
- Test edge cases and error handling
- Fast execution

**Example files:**
- `unit/cp/statuses-test.js` - Tests Statuses class
- `unit/cp/destinations-test.js` - Tests Destinations class
- `unit/cp/text-utilities-test.js` - Tests TextUtilities class

### Integration Tests (`integration/`)

- Test complete workflows
- Use ServiceContainer for dependency management
- May interact with Drafts API (Draft, Alert, etc.)
- Verify component interactions
- Test realistic scenarios

**Example files:**
- `integration/cp/add-draft-to-pipeline-test.js` - Full pipeline workflow
- `integration/cp/convert-draft-to-sheet-test.js` - Document conversion
- `integration/cp/update-status-workflow-test.js` - Status update flow

## Naming Conventions

- Files: `{component}-{scenario}-test.js`
- Test suites: `{Component} {Type} Test` (e.g., "TextUtilities Unit Test")
- Test descriptions: Clear, active voice (e.g., "capitalizeTags executes without error")

## Best Practices

1. **Use test data fixtures** - Never hardcode test data in test files
2. **Clean up** - Reset ServiceContainer between tests: `container.reset()`
3. **Organize with sections** - Use `test.section()` to group related tests
4. **Test both success and failure** - Include error cases and edge cases
5. **Keep tests focused** - Unit tests should test one component
6. **Document test intent** - Use clear test descriptions
7. **Verify test results** - Check mock interactions to verify behavior
8. **Use meaningful assertions** - Choose the most specific assertion type

## Prototype Examples

Two prototype tests demonstrate the new patterns:

### Unit Test: `unit/cp/text-utilities-test.js`

Simple unit test showing:
- Basic assertion usage
- Test data loading
- Section organization
- Edge case testing

### Integration Test: `integration/cp/convert-draft-to-sheet-test.js`

Complex integration test showing:
- ServiceContainer usage
- Mock service configuration
- Workflow testing
- Drafts API interaction
- Multi-step verification

## Extending the Test Suite

### Adding New Tests

1. Determine if test is unit or integration
2. Create test file in appropriate directory
3. Load required infrastructure (`assertions.js`, `testData.js`, `mocks.js`)
4. Create test data in `Library/Data/tests/*.yaml` if needed
5. Write test following the patterns above
6. Create wrapper script in `Library/Scripts/*/tests/`
7. Create Drafts action to run the test

### Adding Test Data

1. Edit `Library/Data/tests/cp-test-data.yaml` (or create new YAML)
2. Add settings, destinations, mockRecords, or scenarios
3. Run `gulp yaml2json` to compile
4. Access via `createCPTestData()` in tests

### Adding Mock Services

1. Edit `Library/Tests/fixtures/mocks.js`
2. Create new mock class with tracking
3. Export factory function
4. Use in tests via `createMock*()`

## Troubleshooting

**Test fails with "Service not registered":**
- Ensure `initializeServices()` is called
- Check ServiceContainer configuration
- Verify all required modules are loaded

**Test data not found:**
- Run `gulp yaml2json` to compile YAML
- Check file paths in `testData.js`
- Verify YAML is valid (no syntax errors)

**Assertion failures:**
- Check actual vs. expected values in console output
- Verify test data matches expectations
- Use `test.info()` to debug values

**Mock not working:**
- Ensure mock is registered in ServiceContainer
- Check mock configuration options
- Verify mock methods match real interface

## Future Enhancements

Potential improvements for the test suite:

- [ ] Test runner for non-Drafts tests
- [ ] Test coverage reporting
- [ ] Performance benchmarking
- [ ] Automated test execution
- [ ] Visual test result dashboard
- [ ] Snapshot testing for UI outputs
- [ ] Async test support

---

**Questions or Issues?**

See `CLAUDE.md` in the project root for development guidance, or check test prototypes for working examples.
