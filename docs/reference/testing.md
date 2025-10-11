# Drafts Scripts Test Suite

This directory contains comprehensive tests for the Drafts scripts project, organized into unit tests, integration tests, and shared test infrastructure.

## Directory Structure

```
Library/Tests/
├── unit/                           # Unit tests (isolated components)
│   ├── cp/                        # Content Pipeline unit tests
│   │   ├── statuses-test.js      # Statuses class tests
│   │   ├── destinations-test.js  # Destinations class tests
│   │   └── text-utilities-test.js # TextUtilities class tests
│   ├── bvr/                       # BVR unit tests
│   └── shared/                    # Shared infrastructure unit tests
├── integration/                    # Integration tests (end-to-end workflows)
│   ├── cp/                        # Content Pipeline integration tests
│   │   └── convert-draft-to-sheet-test.js
│   └── bvr/                       # BVR integration tests
├── fixtures/                       # Test infrastructure
│   ├── assertions.js              # TestAssertions framework
│   ├── testData.js                # Test data loader
│   └── mocks.js                   # Mock service implementations
├── cp/                            # Old tests (being migrated)
├── _archived/                     # Archived/deprecated tests
├── MIGRATION_PLAN.md              # Phase 1 migration plan
└── README.md                      # This file
```

## Quick Start

### Running Tests in Drafts

All tests are designed to run as Drafts actions:

1. Open Drafts app
2. Navigate to the action you want to run (e.g., "Test: Statuses")
3. Run the action
4. View results in the Drafts log

Test actions are located in the `Library/Scripts/cp/tests/` directory as wrapper files that require the actual test files.

### Test Output

Tests use the `TestAssertions` framework which provides:
- ✅ Visual pass/fail indicators
- Detailed failure messages with expected vs actual values
- Section organization for clarity
- Summary statistics with duration

Example output:
```
============================================================
Running: Statuses Unit Tests
============================================================

--- Initialization ---
✅ Statuses instance created
✅ Status list initialized
✅ Status list is an array

--- Status List Contents ---
✅ Status list has correct length
ℹ️  Expected statuses: Developing, Drafting, Writing, Editing, Publishing
✅ Status list contains "Developing"
✅ Status list contains "Drafting"

============================================================
Test Summary: Statuses Unit Tests
============================================================
✅ Passed: 15
❌ Failed: 0
⏱️  Duration: 124ms

✨ All tests passed!
============================================================
```

## Test Types

### Unit Tests

Unit tests verify individual components in isolation with all dependencies mocked.

**Characteristics:**
- Fast execution
- No external dependencies (Airtable, Ulysses, etc.)
- Uses mock services from `fixtures/mocks.js`
- Tests single class or module
- Located in `unit/{module}/`

**Example:** `unit/cp/statuses-test.js`
```javascript
// Load test infrastructure
require("../../fixtures/assertions.js");
require("../../fixtures/testData.js");
require("../../fixtures/mocks.js");

// Load ServiceContainer
require("shared/core/ServiceInitializer.js");

// Load component under test
require("modules/cp/core/Statuses.js");

const test = new TestAssertions('Statuses Unit Tests');

// Setup
resetServices();
initializeServices();
const container = ServiceContainer.getInstance();

// Register mocks
const mockUI = createMockUI({ debug: true });
container.register('cpUI', () => mockUI, true);

// Run tests
test.section('Initialization');
test.assertNotNullish(statuses, 'Statuses created');
// ... more tests

test.summary();
```

### Integration Tests

Integration tests verify end-to-end workflows with multiple components working together.

**Characteristics:**
- Tests complete workflows
- Uses mock external services (Ulysses, database)
- Tests component interactions
- Located in `integration/{module}/`

**Example:** `integration/cp/convert-draft-to-sheet-test.js`
```javascript
// Tests the complete workflow of converting a Draft to a Ulysses sheet
// Includes: document loading, conversion, saving, metadata transfer
```

## Test Infrastructure

### TestAssertions Framework (`fixtures/assertions.js`)

Provides assertion methods for testing:

```javascript
const test = new TestAssertions('My Test');

// Basic assertions
test.assert(condition, 'message');
test.assertEqual(actual, expected, 'message');
test.assertNotEqual(actual, expected, 'message');

// Nullish checks
test.assertNullish(value, 'message');
test.assertNotNullish(value, 'message');

// Type checking
test.assertType(value, 'string', 'message');
test.assertType(obj, 'Statuses', 'message');

// Array/Collection
test.assertIncludes(array, value, 'message');
test.assertArrayLength(array, 5, 'message');

// Functions
test.assertThrows(() => fn(), 'message');
test.assertDoesNotThrow(() => fn(), 'message');

// Organization
test.section('Section Name');
test.info('Informational message');

// Required at end
test.summary(); // Throws if any test failed
```

### Test Data Loader (`fixtures/testData.js`)

Loads standardized test data from JSON files (compiled from YAML):

```javascript
// Load test data helper
const testDataHelper = createCPTestData();

// Get settings
const settings = testDataHelper.getSettings();

// Get destinations for a table
const destinations = testDataHelper.getDestinationsData('table1');

// Get mock records
const mockRecords = testDataHelper.getAllMockRecords();
const record = testDataHelper.getMockRecord('TEST-UUID-001');

// Get copies (to avoid mutations)
const settingsCopy = testDataHelper.getSettingsCopy();
```

### Mock Services (`fixtures/mocks.js`)

Provides mock implementations of external services:

**MockUI:**
```javascript
const mockUI = createMockUI({ debug: true });

// Configure responses
mockUI.setPromptResponse('Select Status:', 'Writing');

// Verify interactions
const prompts = mockUI.getInteractionsByType('prompt');
```

**MockDatabase:**
```javascript
const mockDB = createMockDatabase(mockRecords, { debug: true });

// Query operations
const record = mockDB.retrieveRecordByDocID(doc);

// Verify queries
const queries = mockDB.getQueriesByType('getByDocID');
```

**MockUlysses:**
```javascript
const mockUlysses = createMockUlysses({ debug: true });

// Create sheets
const sheet = mockUlysses.newSheet(content, groupID);

// Verify operations
const ops = mockUlysses.getOperationsByType('newSheet');
```

**MockFileSystem:**
```javascript
const mockFS = createMockFileSystem(testData, { debug: true });

// File operations
const content = mockFS.readFile('/path/to/file.json');
mockFS.writeFile('/path/to/file.json', newContent);

// Verify operations
const reads = mockFS.getOperationsByType('read');
```

## ServiceContainer Pattern

All tests use the ServiceContainer dependency injection framework:

```javascript
// Initialize services
resetServices();  // Clean slate
initializeServices();  // Register all services

// Get container
const container = ServiceContainer.getInstance();

// Register test mocks (override real services)
container.register('cpUI', () => createMockUI({ debug: true }), true);
container.register('cpDatabase', () => createMockDatabase(records), true);
container.register('ulysses', () => createMockUlysses({ debug: true }), true);

// Get services
const contentPipeline = container.get('cpDefault');
const statuses = contentPipeline.statuses;
```

**Why ServiceContainer?**
- Consistent dependency injection
- Easy to swap real services for mocks
- Lazy initialization (services created on first use)
- Singleton management
- Testable architecture

## Test Data

Test data is managed in YAML files and compiled to JSON:

**Source:** `Library/Data/tests/cp-test-data.yaml`
**Compiled:** `Library/Data/tests/cp-test-data.json`
**Build:** `npm run sync` (or `gulp yaml2json`)

**Structure:**
```yaml
settings:
  defaultTag: "In Pipeline"
  statuses:
    statusList:
      - Developing
      - Drafting
      - Writing

destinations:
  table1:
    "Test Destination":
      groupID: "test-group-id"
      airtableName: "Test Table"

mockRecords:
  - docID: "TEST-UUID-001"
    title: "Test Draft 1"
    status: "Writing"
```

## Writing New Tests

### Unit Test Template

```javascript
/**
 * [Component] Unit Test
 *
 * Tests [Component] in isolation with mock dependencies.
 * Verifies: [list key behaviors]
 */

require("../../fixtures/assertions.js");
require("../../fixtures/testData.js");
require("../../fixtures/mocks.js");
require("shared/core/ServiceInitializer.js");
require("modules/path/to/Component.js");

const test = new TestAssertions('[Component] Unit Tests');

// Setup
resetServices();
initializeServices();
const container = ServiceContainer.getInstance();

// Register mocks
const mockUI = createMockUI({ debug: true });
container.register('cpUI', () => mockUI, true);

// Create component
const component = new Component(dependencies);

// Test sections
test.section('Initialization');
// ... assertions

test.summary();
```

### Integration Test Template

```javascript
/**
 * [Workflow] Integration Test
 *
 * Tests end-to-end workflow: [description]
 * Dependencies: [external services needed]
 */

require("../../fixtures/assertions.js");
require("../../fixtures/testData.js");
require("../../fixtures/mocks.js");
require("shared/core/ServiceInitializer.js");

// Load required modules
require("modules/cp/core/ContentPipeline.js");

const test = new TestAssertions('[Workflow] Integration Test');

// Setup
resetServices();
initializeServices();
const container = ServiceContainer.getInstance();

// Register mocks
container.register('cpDatabase', () => createMockDatabase(records), true);
container.register('ulysses', () => createMockUlysses({ debug: true }), true);

// Get services
const contentPipeline = container.get('cpDefault');

// Test workflow
test.section('Setup');
// ... test steps

test.summary();
```

## Best Practices

### 1. Always Use ServiceContainer

```javascript
// ❌ BAD - Manual instantiation
const statuses = new Statuses(dependencies);

// ✅ GOOD - ServiceContainer
const contentPipeline = container.get('cpDefault');
const statuses = contentPipeline.statuses;
```

### 2. Always Use Mock External Services

```javascript
// ❌ BAD - Real Ulysses (makes x-callback-url calls!)
const ulysses = new Ulysses();

// ✅ GOOD - MockUlysses
const mockUlysses = createMockUlysses({ debug: true });
container.register('ulysses', () => mockUlysses, true);
```

### 3. Use Standardized Test Data

```javascript
// ❌ BAD - Hardcoded test data
const settings = { statuses: { statusList: ['A', 'B'] } };

// ✅ GOOD - Centralized test data
const testDataHelper = createCPTestData();
const settings = testDataHelper.getSettings();
```

### 4. Cache Values Before Modifications

```javascript
// ❌ BAD - Shared object reference issues
const record = { docID: testDraft.uuid };
const doc1 = factory.load(record);
const doc2 = factory.load(record); // Shares same record object!
doc2.record.docID = 'new-id'; // Modifies doc1's record too!

// ✅ GOOD - Cache values before modifications
const originalDocID = doc1.docID;
doc2.record.docID = 'new-id';
test.assertNotEqual(doc1.docID, originalDocID); // Safe
```

### 5. Use Descriptive Test Names

```javascript
// ❌ BAD
test.assert(list.length === 6, 'works');

// ✅ GOOD
test.assertEqual(list.length, 6, 'Status list contains 6 items');
```

### 6. Organize with Sections

```javascript
test.section('Initialization');
// ... initialization tests

test.section('Validation');
// ... validation tests

test.section('Error Handling');
// ... error tests
```

### 7. Always End with summary()

```javascript
// Required! Throws if any test failed
test.summary();
```

## Common Pitfalls

### Typo: textUtilities vs textUltilities

```javascript
// ❌ WRONG (common typo that caused bugs!)
dependencies['textUltilities'] = new TextUtilities();

// ✅ CORRECT
dependencies['textUtilities'] = new TextUtilities();
```

### Using Real Ulysses in Tests

```javascript
// ❌ WRONG - Makes actual x-callback-url calls
const ulysses = new Ulysses();

// ✅ CORRECT - Uses mock
const mockUlysses = createMockUlysses({ debug: true });
```

### Missing defaultTag

```javascript
// ❌ WRONG - Many classes expect defaultTag
const dependencies = { ui, fileSystem, settings, tableName };

// ✅ CORRECT
const dependencies = {
  ui,
  fileSystem,
  settings,
  tableName,
  defaultTag: settings.defaultTag,
};
```

## Migration Status

See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for detailed migration status and priorities.

### ✅ Completed
- Test infrastructure (assertions, testData, mocks)
- Test data YAML and JSON compilation
- Unit tests: TextUtilities, Statuses, Destinations
- Integration tests: Convert Draft to Sheet
- Test wrappers updated

### 🚧 In Progress
- Additional integration tests (add-draft-to-pipeline, open-documents, etc.)
- Database connection tests
- Document lifecycle tests

### 📋 Planned
- BVR module tests
- Shared infrastructure tests
- Full test coverage for all components

## Running the Full Test Suite

Currently, tests are run individually as Drafts actions. A future enhancement may add a test runner for batch execution.

**Available Test Actions:**
- Test: TextUtilities
- Test: Statuses
- Test: Destinations
- Test: Convert Draft to Sheet

## Contributing

When adding new tests:

1. Use the appropriate template (unit vs integration)
2. Follow the ServiceContainer pattern
3. Use standardized test data
4. Include all required dependencies
5. Add descriptive test names and sections
6. Always end with `test.summary()`
7. Update test wrapper in `Library/Scripts/cp/tests/`
8. Update this README if needed

## Resources

- **Testing Guide:** `.claude/prompts/testing-guide.md` - Comprehensive guide
- **ServiceContainer Docs:** `Library/Scripts/shared/core/ServiceContainer.js`
- **Example Tests:**
  - Unit: `unit/cp/text-utilities-test.js`
  - Integration: `integration/cp/convert-draft-to-sheet-test.js`

## Questions?

Refer to:
1. `.claude/prompts/testing-guide.md` for detailed patterns
2. Existing test files for examples
3. `fixtures/` directory for infrastructure details
