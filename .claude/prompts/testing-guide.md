# Testing Guide for Drafts Scripts

## Overview

This guide provides comprehensive instructions for creating, organizing, and maintaining tests for the Drafts scripts project. It covers both unit tests (isolated component testing) and integration tests (end-to-end workflow testing) using the ServiceContainer dependency injection framework and standardized test data.

## Test Organization & Structure

### Directory Structure

```
Library/Tests/
├── unit/                           # Individual component tests
│   ├── cp/
│   │   ├── statuses-test.js       # Test Statuses class in isolation
│   │   ├── destinations-test.js   # Test Destinations class
│   │   ├── document-factory-test.js
│   │   └── text-utilities-test.js
│   ├── bvr/
│   │   └── team-test.js
│   └── shared/
│       └── servicecontainer-test.js
├── integration/                    # End-to-end workflow tests
│   ├── cp/
│   │   ├── add-draft-to-pipeline-test.js
│   │   ├── convert-draft-to-sheet-test.js
│   │   ├── create-ulysses-doc-test.js
│   │   └── update-status-workflow-test.js
│   └── bvr/
│       └── team-workflow-test.js
├── fixtures/                       # Test helper modules
│   ├── testRunner.js              # Optional test runner for non-Drafts code
│   ├── assertions.js              # TestAssertions framework
│   ├── testData.js                # Standardized test data loader
│   └── mocks.js                   # Mock service factories
└── README.md                       # Test documentation
```

**Naming Convention**: `{component}-{scenario}-test.js` (e.g., `statuses-validation-test.js`)

### Test File Locations

- **Unit tests**: `Library/Tests/unit/{module}/{test-name}-test.js`
- **Integration tests**: `Library/Tests/integration/{module}/{test-name}-test.js`
- **Test fixtures**: `Library/Tests/fixtures/`
- **Test data**: `Library/Data/tests/` (YAML source files, compiled to JSON)

## Test File Template

### Unit Test Template

```javascript
/**
 * {Component Name} Unit Test
 *
 * Tests {Component} in isolation with mock dependencies.
 * Verifies: {list key behaviors being tested}
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");
require("../Tests/fixtures/mocks.js");

// Load ServiceContainer framework
require("shared/core/ServiceInitializer.js");

// Load component under test
require("modules/{module}/core/{Component}.js");

// Create test instance
const test = new TestAssertions('{Component} Unit Tests');

// Setup with ServiceContainer
resetServices();
initializeServices();

const container = ServiceContainer.getInstance();

// Register test mocks
container.register('cpFileSystem', () => createMockFS(getCPTestData()), true);
container.register('cpUI', () => createMockUI({ debug: true }), true);

// Test sections follow...
test.section('Component Initialization');
// ...

test.summary();
```

### Integration Test Template

```javascript
/**
 * {Workflow Name} Integration Test
 *
 * Tests end-to-end workflow: {brief description}
 * Dependencies: {list external dependencies}
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");
require("../Tests/fixtures/mocks.js");

// Load ServiceContainer framework
require("shared/core/ServiceInitializer.js");

// Load required modules
require("modules/{module}/core/{Class}.js");
// ... other requires

// Load test implementations
require("modules/{module}/databases/TestDB.js");
require("modules/{module}/filesystems/TestFS.js");

// Create test instance
const test = new TestAssertions('{Workflow} Integration Test');

// Setup
resetServices();
initializeServices();

const container = ServiceContainer.getInstance();

// Register test services
container.register('cpDatabase', () => new TestDB(getMockRecords()), true);
container.register('cpFileSystem', () => new TestFS(getCPTestData()), true);
container.register('cpUI', () => createMockUI({ debug: true }), true);

// Get services under test
const contentPipeline = container.get('cpDefault');

// Test sections follow...
test.section('Setup and Configuration');
// ...

test.summary();
```

## ServiceContainer Integration

### Core Pattern

All tests MUST:
1. Call `initializeServices()` at startup or use `resetServices()` for test isolation
2. Retrieve dependencies via `ServiceContainer.getInstance().get('serviceName')`
3. Never manually instantiate core services (use container instead)
4. Register test-specific mocks in the container when needed

### Example Implementation

```javascript
require("shared/core/ServiceInitializer.js");

// Setup - clean slate for this test
resetServices();
initializeServices();

const container = ServiceContainer.getInstance();

// Register test mocks
container.register('cpFileSystem', () => new TestFS(testData), true);
container.register('cpUI', () => new MockUI({ debug: true }), true);
container.register('ulysses', () => createMockUlysses({ debug: true }), true);

// Get services under test
const contentPipeline = container.get('cpDefault');
const statuses = contentPipeline.statuses;
const destinations = contentPipeline.destinations;

// Run tests
test.assertEqual(statuses.list.length, 6, 'Status list loaded from container');
```

### Service Registration Patterns

```javascript
// Singleton (same instance always returned)
container.register('cpSettings', () => getCPSettings(), true);

// Factory (new instance each time)
container.register('cpDocument', () => new DocumentFactory(deps), false);

// With dependencies
container.register('cpDefault', () => {
  const settings = container.get('cpSettings');
  const fs = container.get('cpFileSystem');
  return new ContentPipeline(settings, fs);
}, true);
```

## Standardized Test Data

### Test Data Structure

Create centralized test data in `Library/Data/tests/`:

```
Library/Data/tests/
├── cp-test-data.yaml              # Content Pipeline test fixtures
├── bvr-test-data.yaml             # BVR test fixtures
├── destinations-test-data.yaml    # Destinations configurations
└── documents-test-data.yaml       # Mock document data
```

### YAML Structure Example

**cp-test-data.yaml:**
```yaml
settings:
  defaultTag: "In Pipeline"
  statuses:
    selectStatus:
      errorMessage: "Error: You must select a status!!"
    statusList:
      - Developing
      - Drafting
      - Writing
      - Revising
      - Editing
      - Publishing

destinations:
  table1:
    inbox:
      groupID: "test-inbox-id"
    "Test Destination":
      groupID: "test-dest-id"
      airtableName: "Test Table"
      template: "testTemplate"

mockRecords:
  - docID: "TEST-UUID-001"
    docIDType: "DraftsID"
    title: "Test Draft 1"
    status: "Writing"
    destination: "Test Destination"
    content: "Test content for draft 1"
  - docID: "TEST-UUID-002"
    docIDType: "UlyssesID"
    title: "Test Sheet 1"
    status: "Editing"
```

### Test Data Loader

**Library/Tests/fixtures/testData.js:**
```javascript
/**
 * Test Data Loader
 *
 * Loads compiled JSON test data and provides factory functions
 * for accessing standardized test fixtures.
 */

// Load compiled JSON from Library/Data/tests/
const cpTestData = JSON.parse(
  FileManager.readString('/path/to/Library/Data/tests/cp-test-data.json')
);

const bvrTestData = JSON.parse(
  FileManager.readString('/path/to/Library/Data/tests/bvr-test-data.json')
);

// Export factory functions
function getCPSettings() {
  return JSON.parse(JSON.stringify(cpTestData.settings)); // Deep copy
}

function getCPTestData() {
  return JSON.parse(JSON.stringify(cpTestData)); // Deep copy
}

function getDestinationsData() {
  return JSON.parse(JSON.stringify(cpTestData.destinations));
}

function getMockRecords() {
  return JSON.parse(JSON.stringify(cpTestData.mockRecords));
}

function getMockRecord(docID) {
  return cpTestData.mockRecords.find(r => r.docID === docID);
}

function getBVRTestData() {
  return JSON.parse(JSON.stringify(bvrTestData));
}

// Make functions available globally for tests
this.getCPSettings = getCPSettings;
this.getCPTestData = getCPTestData;
this.getDestinationsData = getDestinationsData;
this.getMockRecords = getMockRecords;
this.getMockRecord = getMockRecord;
this.getBVRTestData = getBVRTestData;
```

**Build Process**: Gulp auto-converts YAML → JSON for runtime use

## Mock Service Implementations

### When to Create Mocks

Create mock implementations for:
- External app integrations (Ulysses, Bear, etc.)
- Network/API calls (Airtable, NocoDB)
- File system operations (use TestFS or MockFileSystem)
- UI interactions (use MockUI)
- Database operations (use TestDB or MockDatabase)

**Note**: Drafts API objects (e.g., `Draft`, `Alert`, `Prompt`) run natively in Drafts environment, so no mocking needed for those.

### Mock Service Requirements

A proper mock must:

1. **Implement all methods used by the code under test**
2. **Return properly structured objects**
3. **Track operations for assertions**
4. **Handle error states**

### Mock UI Implementation

```javascript
/**
 * MockUI - Test double for UI interactions
 *
 * Tracks all UI interactions for test assertions without
 * displaying actual prompts or alerts.
 */
class MockUI {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.interactions = [];  // Track all UI interactions
  }

  displayPrompt(config) {
    this.interactions.push({ type: 'prompt', config });
    if (this.debug) {
      console.log('MockUI Prompt:', config.title);
    }
    return config.defaultValue || null;
  }

  displayErrorMessage(config) {
    this.interactions.push({ type: 'error', config });
    if (this.debug) {
      console.log('MockUI Error:', config.errorMessage);
    }
  }

  displaySuccessMessage(config) {
    this.interactions.push({ type: 'success', config });
    if (this.debug) {
      console.log('MockUI Success:', config.successMessage);
    }
  }

  displayMenu(config) {
    this.interactions.push({ type: 'menu', config });
    if (this.debug) {
      console.log('MockUI Menu:', config.title);
    }
    return config.defaultSelection || config.options[0];
  }

  // Helper for test assertions
  getInteractionsByType(type) {
    return this.interactions.filter(i => i.type === type);
  }

  clearInteractions() {
    this.interactions = [];
  }
}
```

### Mock Ulysses Implementation

```javascript
/**
 * MockUlysses - Test double for Ulysses app integration
 *
 * CRITICAL: Always use MockUlysses in tests, never real Ulysses.
 * Real Ulysses makes x-callback-url calls that fail in tests.
 */
class MockUlysses {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.sheets = new Map();
    this.nextSheetId = 1;
    this.operations = [];
    this.error = false;
    this.errorCode = 0;
    this.errorMessage = '';
  }

  newSheet(content, groupID) {
    this.operations.push({ type: 'newSheet', content, groupID });

    const sheet = {
      identifier: `mock-ulysses-${this.nextSheetId++}`,
      title: this._extractTitle(content),
      text: content,
      keywords: [],
      notes: [],
      groupID: groupID,
      hasKeyword: function(keyword) {
        return this.keywords.includes(keyword);
      }
    };

    this.sheets.set(sheet.identifier, sheet);
    this.error = false;

    if (this.debug) {
      console.log(`MockUlysses: Created sheet ${sheet.identifier}`);
    }

    return sheet;
  }

  readSheet(sheetId) {
    this.operations.push({ type: 'readSheet', sheetId });

    const sheet = this.sheets.get(sheetId);
    if (!sheet) {
      this.error = true;
      this.errorCode = 1;
      this.errorMessage = 'Sheet not found';
      return null;
    }

    this.error = false;
    return sheet;
  }

  attachKeywords(sheetId, keywords) {
    this.operations.push({ type: 'attachKeywords', sheetId, keywords });

    const sheet = this.sheets.get(sheetId);
    if (!sheet) {
      this.error = true;
      return false;
    }

    sheet.keywords = [...new Set([...sheet.keywords, ...keywords])];
    this.error = false;
    return true;
  }

  _extractTitle(content) {
    const lines = content.split('\n');
    const firstLine = lines[0] || 'Untitled';
    return firstLine.replace(/^#+\s*/, '').trim();
  }

  // Helper for test assertions
  getOperationsByType(type) {
    return this.operations.filter(op => op.type === type);
  }

  clearOperations() {
    this.operations = [];
  }
}
```

### Mock Database Implementation

```javascript
/**
 * MockDatabase - Test double for database operations
 *
 * Provides in-memory storage for test records without
 * connecting to actual Airtable or NocoDB.
 */
class MockDatabase {
  constructor(testRecords = []) {
    this.records = new Map(testRecords.map(r => [r.docID, r]));
    this.queries = [];  // Track all queries
  }

  retrieveRecordByDocID(doc) {
    this.queries.push({ type: 'getByDocID', doc });
    return this.records.get(doc.docID) || null;
  }

  updateRecord(docID, fields) {
    this.queries.push({ type: 'update', docID, fields });

    const record = this.records.get(docID);
    if (!record) return false;

    Object.assign(record, fields);
    return true;
  }

  createRecord(fields) {
    this.queries.push({ type: 'create', fields });

    const docID = `MOCK-${Date.now()}`;
    const record = { docID, ...fields };
    this.records.set(docID, record);
    return record;
  }

  deleteRecord(docID) {
    this.queries.push({ type: 'delete', docID });
    return this.records.delete(docID);
  }

  // Helper for test assertions
  getQueriesByType(type) {
    return this.queries.filter(q => q.type === type);
  }

  clearQueries() {
    this.queries = [];
  }
}
```

### Mock Factory Functions

**Library/Tests/fixtures/mocks.js:**
```javascript
/**
 * Mock Service Factories
 *
 * Provides factory functions for creating mock services
 * that can be registered in ServiceContainer for testing.
 */

// Export factory functions for ServiceContainer
function createMockUI(options) {
  return new MockUI(options);
}

function createMockFS(testData) {
  return new TestFS(testData);
}

function createMockDatabase(testRecords) {
  return new MockDatabase(testRecords);
}

function createMockUlysses(options) {
  return new MockUlysses(options);
}

// Make factories available globally for tests
this.createMockUI = createMockUI;
this.createMockFS = createMockFS;
this.createMockDatabase = createMockDatabase;
this.createMockUlysses = createMockUlysses;
```

## Dependency Management

### Critical Pattern: Use Mock Services for External Dependencies

**❌ WRONG - Using Real Services:**
```javascript
const ulysses = new Ulysses();  // Makes actual x-callback-url calls!
```

**✅ CORRECT - Using Mock Services:**
```javascript
const mockUlysses = createMockUlysses({ debug: true });
```

### Required Dependencies for Content Pipeline Tests

All Content Pipeline tests require these dependencies:

```javascript
const dependencies = {
  ui: createMockUI({ debug: true }),
  fileSystem: createMockFS(getCPTestData()),
  settings: getCPSettings(),
  tableName: 'table1',
  textUtilities: new TextUtilities(),  // Note spelling: textUtilities!
  ulysses: createMockUlysses({ debug: true }),  // ALWAYS mock, never real
  defaultTag: getCPSettings().defaultTag,
};

// Initialize lazy dependencies
const statuses = new Statuses(dependencies);
dependencies['statuses'] = statuses;

const destinations = new Destinations(dependencies);
dependencies['destinations'] = destinations;
```

### Common Pitfalls

1. **Typo: `textUltilities` vs `textUtilities`**
   - ALWAYS use `textUtilities` (correct spelling)
   - This was a widespread bug that caused `undefined` errors

2. **Missing ulysses dependency**
   - UlyssesDoc REQUIRES a ulysses instance
   - ALWAYS use MockUlysses, never real Ulysses
   - Real Ulysses makes x-callback-url calls that fail in tests

3. **Missing defaultTag**
   - Many classes expect `dependencyProvider.defaultTag`
   - Include it in the dependencies object

4. **Not using ServiceContainer**
   - Don't manually create service instances
   - Always register them in ServiceContainer and retrieve via `get()`

## Test Assertions & Reporting

### TestAssertions Framework

**Library/Tests/fixtures/assertions.js:**
```javascript
/**
 * TestAssertions - Lightweight test framework for Drafts
 *
 * Provides assertion methods and test organization features
 * with console-based output for Drafts log viewer.
 */
class TestAssertions {
  constructor(testName) {
    this.testName = testName;
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    this.currentSection = null;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Starting: ${testName}`);
    console.log('='.repeat(60));
  }

  section(name) {
    this.currentSection = name;
    console.log(`\n--- ${name} ---`);
  }

  info(message) {
    console.log(`ℹ️  ${message}`);
  }

  assert(condition, message) {
    if (condition) {
      console.log(`✅ ${message}`);
      this.passed++;
    } else {
      const error = `❌ ${message}`;
      console.log(error);
      this.errors.push({ section: this.currentSection, message: error });
      this.failed++;
    }
  }

  assertEqual(actual, expected, message) {
    const condition = actual === expected;
    if (!condition) {
      message += ` (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`;
    }
    this.assert(condition, message);
  }

  assertNotEqual(actual, expected, message) {
    const condition = actual !== expected;
    if (!condition) {
      message += ` (both values are: ${JSON.stringify(actual)})`;
    }
    this.assert(condition, message);
  }

  assertNotNullish(value, message) {
    const condition = value !== null && value !== undefined;
    if (!condition) {
      message += ` (got: ${value})`;
    }
    this.assert(condition, message);
  }

  assertNullish(value, message) {
    const condition = value === null || value === undefined;
    if (!condition) {
      message += ` (got: ${JSON.stringify(value)})`;
    }
    this.assert(condition, message);
  }

  assertType(value, expectedType, message) {
    const actualType = value?.constructor?.name || typeof value;
    const condition = actualType === expectedType;
    if (!condition) {
      message += ` (expected type: ${expectedType}, got: ${actualType})`;
    }
    this.assert(condition, message);
  }

  assertThrows(fn, message) {
    try {
      fn();
      this.assert(false, message + ' (no error thrown)');
    } catch (e) {
      this.assert(true, message);
    }
  }

  assertDoesNotThrow(fn, message) {
    try {
      fn();
      this.assert(true, message);
    } catch (e) {
      this.assert(false, message + ` (error thrown: ${e.message})`);
    }
  }

  assertContains(array, item, message) {
    const condition = array.includes(item);
    if (!condition) {
      message += ` (${JSON.stringify(item)} not found in array)`;
    }
    this.assert(condition, message);
  }

  assertArrayLength(array, expectedLength, message) {
    const condition = array.length === expectedLength;
    if (!condition) {
      message += ` (expected length: ${expectedLength}, got: ${array.length})`;
    }
    this.assert(condition, message);
  }

  summary() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test Summary: ${this.testName}`);
    console.log(`Passed: ${this.passed} | Failed: ${this.failed}`);

    if (this.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.errors.forEach(err => {
        if (err.section) {
          console.log(`  [${err.section}] ${err.message}`);
        } else {
          console.log(`  ${err.message}`);
        }
      });
      console.log('='.repeat(60));
      throw new Error(`${this.failed} test(s) failed in ${this.testName}`);
    } else {
      console.log('✅ All tests passed!');
      console.log('='.repeat(60));
    }
  }
}

// Make TestAssertions available globally for tests
this.TestAssertions = TestAssertions;
```

### Usage Examples

```javascript
const test = new TestAssertions('Statuses Component Tests');

test.section('Status List Initialization');
test.assertEqual(statuses.list.length, 6, 'Status list has 6 items');
test.assertContains(statuses.list, 'Writing', 'Status list contains "Writing"');

test.section('Status Validation');
test.assertThrows(() => statuses.validate(null), 'Validation fails on null');
test.assertDoesNotThrow(() => statuses.validate('Writing'), 'Valid status accepted');

test.section('Type Checking');
test.assertType(statuses, 'Statuses', 'Object is Statuses instance');
test.assertNotNullish(statuses.errorMessage, 'Has error message defined');

test.summary();  // Throws if any test failed
```

## Shared Object Reference Pitfalls

### The Problem

When multiple objects share references to the same object, modifications affect all of them:

```javascript
// Both activeDoc and newDoc reference the same record object
const record = { docID: testDraft.uuid, docIDType: 'DraftsID' };
let activeDoc = documentFactory.load(record);

// Later, setting the record modifies the shared object
newDoc.record = record;  // Modifies record.docID and record.docIDType!

// Now activeDoc.docID reads from the modified record!
test.assert(newDoc.docID !== activeDoc.docID);  // FAILS!
```

### The Solution

Cache values BEFORE modifying shared objects:

```javascript
// Cache docIDs before modifying the shared record
const originalDraftDocID = activeDoc.docID;
const newSheetDocID = newDoc.docID;

// Now safe to modify the shared record
newDoc.record = record;

// Use cached values for assertions
test.assert(newSheetDocID !== originalDraftDocID);  // ✅ PASSES
```

## Type Assertions

### Use Actual Class Names

```javascript
// ❌ WRONG - Conceptual name
test.assertType(newDoc, 'SheetDoc', 'Created document is SheetDoc type');

// ✅ CORRECT - Actual class name
test.assertType(newDoc, 'UlyssesDoc', 'Created document is UlyssesDoc type');
```

The `assertType` method checks `value.constructor.name`, so use the actual JavaScript class name.

## Test Organization Best Practices

### 1. Use Clear Sections

```javascript
test.section('Setup and Configuration');
// ... setup code

test.section('Create Test Document');
// ... document creation

test.section('Verify Document Properties');
// ... property checks

test.section('Perform Operation');
// ... main test operation

test.section('Verify Results');
// ... result assertions

test.section('Cleanup');
// ... cleanup code
```

### 2. Use Info Messages for Context

```javascript
test.info(`Test draft UUID: ${testDraft.uuid}`);
test.info(`Source status: ${sourceStatus}`);
test.info(`Source destination: ${sourceDestination}`);
test.info(`Content length: ${sourceContent.length} characters`);
```

### 3. Document Assumptions and Behavior

```javascript
// Link the new sheet to the original draft record
// Note: Setting the record updates it to point to the new sheet's docID
const originalDraftDocID = activeDoc.docID;
newDoc.record = record;
```

### 4. Cache Values Before State Changes

```javascript
// Save values BEFORE operations that modify shared state
const sourceStatus = activeDoc.status;
const sourceDestination = activeDoc.destination;
const sourceContent = activeDoc.content;

// Now perform operations
newDoc.status = sourceStatus;
newDoc.destination = sourceDestination;
newDoc.content = sourceContent;
```

## Common Test Scenarios

### Testing Document Conversion

```javascript
test.section('Load Source Document');
const record = { docID: sourceId, docIDType: 'DraftsID' };
let sourceDoc = documentFactory.load(record);
test.assertNotNullish(sourceDoc, 'Source document loaded');

test.section('Extract Properties');
// Cache them BEFORE any modifications!
const sourceStatus = sourceDoc.status;
const sourceDestination = sourceDoc.destination;
const sourceContent = sourceDoc.content;

test.info(`Source status: ${sourceStatus}`);
test.info(`Source destination: ${sourceDestination}`);

test.section('Create Target Document');
let targetDoc = documentFactory.create('sheet');
test.assertNotNullish(targetDoc, 'Target document created');
test.assertType(targetDoc, 'UlyssesDoc', 'Target is UlyssesDoc');

test.section('Transfer Properties');
targetDoc.status = sourceStatus;
targetDoc.destination = sourceDestination;
targetDoc.content = sourceContent;

test.section('Save Target Document');
test.assertDoesNotThrow(() => {
  targetDoc.save();
}, 'Target document saves without error');

test.section('Verify Conversion');
// Use cached values!
test.assertNotEqual(targetDoc.docID, sourceDoc.docID, 'Different docID');
test.assertEqual(targetDoc.status, sourceStatus, 'Status preserved');
test.assertEqual(targetDoc.destination, sourceDestination, 'Destination preserved');
test.assertEqual(targetDoc.content, sourceContent, 'Content preserved');
```

### Testing Document Lifecycle

```javascript
test.section('Create Document');
let doc = documentFactory.create('draft');
test.assertNotNullish(doc, 'Document created');
test.assertType(doc, 'DraftsDoc', 'Document is DraftsDoc');

test.section('Modify Document');
doc.status = 'Writing';
doc.destination = 'Test Blog';
doc.content = 'Test content';

test.assertEqual(doc.status, 'Writing', 'Status set');
test.assertEqual(doc.destination, 'Test Blog', 'Destination set');

test.section('Save Document');
test.assertDoesNotThrow(() => doc.save(), 'Document saves');
test.assertNotNullish(doc.docID, 'Has docID after save');

const savedDocID = doc.docID;
test.info(`Saved document ID: ${savedDocID}`);

test.section('Load Document');
const loadedDoc = documentFactory.load({
  docID: savedDocID,
  docIDType: doc.docIDType
});
test.assertNotNullish(loadedDoc, 'Document loaded');
test.assertEqual(loadedDoc.status, 'Writing', 'Status persisted');
test.assertEqual(loadedDoc.destination, 'Test Blog', 'Destination persisted');

test.section('Delete Document');
test.assertDoesNotThrow(() => doc.delete(), 'Document deletes');
```

### Testing Component Initialization

```javascript
test.section('ServiceContainer Registration');
const container = ServiceContainer.getInstance();
test.assertNotNullish(container, 'Container instance exists');

test.section('Service Registration');
container.register('testService', () => new TestService(), true);
test.assertDoesNotThrow(() => {
  container.get('testService');
}, 'Service can be retrieved');

test.section('Service Singleton Behavior');
const service1 = container.get('testService');
const service2 = container.get('testService');
test.assert(service1 === service2, 'Singleton returns same instance');

test.section('Lazy Initialization');
let initCount = 0;
container.register('lazyService', () => {
  initCount++;
  return new TestService();
}, true);

test.assertEqual(initCount, 0, 'Service not initialized on registration');
container.get('lazyService');
test.assertEqual(initCount, 1, 'Service initialized on first get');
container.get('lazyService');
test.assertEqual(initCount, 1, 'Service not re-initialized on second get');
```

## Test Execution

### Manual Execution in Drafts

All tests are Drafts actions:
1. Navigate to the test action in Drafts
2. Run the action
3. View console output in Drafts log
4. Test throws an error if any assertion fails

### Optional Test Runner for Non-Drafts Code

If certain modules don't require Drafts API (e.g., TextUtilities, ServiceContainer), create:

**Library/Tests/fixtures/testRunner.js:**
```javascript
/**
 * Test Runner for Non-Drafts Code
 *
 * Runs tests for modules that don't require Drafts API.
 * Can be executed outside of Drafts environment for faster testing.
 */

const tests = [
  'unit/shared/servicecontainer-test.js',
  'unit/cp/text-utilities-test.js',
  // ... tests that don't need Drafts API
];

let totalPassed = 0;
let totalFailed = 0;
const failedTests = [];

console.log('='.repeat(60));
console.log('=== Running Test Suite ===');
console.log('='.repeat(60));

tests.forEach(testPath => {
  try {
    console.log(`\nRunning: ${testPath}`);
    require(`../${testPath}`);  // Assumes test throws on failure
    totalPassed++;
    console.log(`✅ ${testPath} passed`);
  } catch (e) {
    totalFailed++;
    failedTests.push({ path: testPath, error: e });
    console.log(`\n❌ Test failed: ${testPath}`);
    console.log(e.message);
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`Test Suite Complete`);
console.log(`Passed: ${totalPassed} | Failed: ${totalFailed}`);
console.log('='.repeat(60));

if (totalFailed > 0) {
  console.log('\n❌ Failed Tests:');
  failedTests.forEach(({ path, error }) => {
    console.log(`  ${path}`);
    console.log(`    ${error.message}`);
  });
  throw new Error(`${totalFailed} test file(s) failed`);
} else {
  console.log('\n✅ All test files passed!');
}
```

## File Path Updates

### IMPORTANT: Update Wrapper Actions

When moving/renaming test files, update wrapper actions in `Library/Scripts/cp/tests/`:

These wrapper files map Drafts action names to test file paths.

```javascript
// Example: Library/Scripts/cp/tests/run-statuses-test.js

// OLD: require("../../Tests/cp/statuses.js");
// NEW: require("../../Tests/unit/cp/statuses-test.js");

// Always use paths relative to Library/Scripts/
require("../../Tests/unit/cp/statuses-test.js");
```

## Test Coverage Plan

### Phase 1: Reimplement Existing Tests (Primary Focus)

Migrate current tests to new structure:
1. Identify which tests are unit vs. integration
2. Update to use ServiceContainer pattern
3. Refactor to use standardized test data
4. Move to appropriate directories
5. Update wrapper actions with new paths

### Phase 2: Expand Coverage (After Phase 1 Complete)

Add comprehensive tests for:

**ContentPipeline workflows:**
- Adding drafts to pipeline (validation, success, errors)
- Updating document status
- Converting between document types
- Pipeline state persistence

**Document types:**
- DraftsDoc: create, load, save, delete, metadata
- UlyssesDoc: create, load, callbacks, excerpt generation
- SheetDoc: create, save, Airtable sync
- Document factory selection logic

**ServiceContainer:**
- Service registration (singleton vs. factory)
- Lazy instantiation
- Dependency resolution
- Error handling for missing services
- Reset functionality

**Database integrations:**
- AirTableDB: connect, query, CRUD operations, error handling
- NocoDBDB: same coverage
- Recent records caching
- Record validation

**UI interactions:**
- Prompt displays and validation
- Menu selections
- Error messages
- Debug modes

## Integration Test Checklist

Before submitting an integration test, verify:

- [ ] Uses ServiceContainer for dependency injection
- [ ] Calls `resetServices()` and `initializeServices()` at startup
- [ ] Uses mock services for all external dependencies (Ulysses, Bear, etc.)
- [ ] All dependencies spelled correctly (`textUtilities`, not `textUltilities`)
- [ ] Includes all required dependencies (ui, fileSystem, settings, tableName, textUtilities, defaultTag)
- [ ] Loads test data from standardized fixtures
- [ ] Caches values before modifying shared objects
- [ ] Uses actual class names in type assertions
- [ ] Has clear section headers
- [ ] Includes info messages for key values
- [ ] Documents non-obvious behavior
- [ ] Uses `assertDoesNotThrow` for operations that might fail
- [ ] Verifies results after state changes
- [ ] Cleans up test data
- [ ] Ends with `test.summary()`

## Unit Test Checklist

Before submitting a unit test, verify:

- [ ] Tests component in isolation
- [ ] Uses ServiceContainer for dependency injection
- [ ] Registers mock dependencies in container
- [ ] Does not test external dependencies (those should be mocked)
- [ ] Tests all public methods of the component
- [ ] Tests edge cases and error conditions
- [ ] Uses standardized test data
- [ ] Has clear section organization
- [ ] Each assertion has descriptive message
- [ ] Ends with `test.summary()`

## Migration Strategy

When migrating existing test files:

### 1. Add Test Infrastructure

```javascript
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");
require("../Tests/fixtures/mocks.js");
require("shared/core/ServiceInitializer.js");
```

### 2. Replace alert() with Assertions

```javascript
// Before
alert(newDoc.docID);

// After
test.assertNotNullish(newDoc.docID, 'Document has docID');
test.info(`Document ID: ${newDoc.docID}`);
```

### 3. Add Section Headers

```javascript
test.section('Create Document');
// ... creation code

test.section('Verify Properties');
// ... assertions
```

### 4. Replace Real Services with Mocks

```javascript
// Before
const ulysses = new Ulysses();

// After
const mockUlysses = createMockUlysses({ debug: true });
```

### 5. Use ServiceContainer

```javascript
// Before
const statuses = new Statuses(dependencies);

// After
resetServices();
initializeServices();
const container = ServiceContainer.getInstance();
const statuses = container.get('cpDefault').statuses;
```

### 6. Add Summary

```javascript
test.summary();  // Throws if any test failed
```

## Working Directory

⚠️ **CRITICAL:**
- Work ONLY in the `dev/` folder
- DO NOT modify files in iCloud Drafts directory directly
- Let sync process handle copying to iCloud
- Test changes locally before syncing

## Implementation Checklist

### Initial Setup
- [ ] Create directory structure (unit/, integration/, fixtures/)
- [ ] Create test data YAML files in Library/Data/tests/
- [ ] Update gulpfile.js to process test YAML → JSON
- [ ] Create fixtures/testData.js test data loader
- [ ] Create fixtures/assertions.js assertion helpers
- [ ] Create fixtures/mocks.js mock service factories
- [ ] Update TestDB.js and TestFS.js for ServiceContainer
- [ ] Create Library/Tests/README.md documentation

### Phase 1: Migration
- [ ] Identify all existing tests
- [ ] Categorize as unit or integration tests
- [ ] Migrate unit tests to new structure
- [ ] Migrate integration tests to new structure
- [ ] Update all tests to use ServiceContainer pattern
- [ ] Update all tests to use standardized test data
- [ ] Update test wrapper files in Library/Scripts/cp/tests/
- [ ] Verify all tests pass in Drafts environment

### Phase 2: Expansion
- [ ] Add ContentPipeline workflow tests
- [ ] Add Document type tests
- [ ] Add ServiceContainer tests
- [ ] Add Database integration tests
- [ ] Add UI interaction tests
- [ ] Create test runner for non-Drafts tests (optional)

## Example: Complete Integration Test

See `Library/Tests/integration/cp/convert-draft-to-sheet-test.js` for a complete, working example that demonstrates all these patterns.

## Additional Resources

- **ServiceContainer Documentation**: See `Library/Scripts/shared/core/ServiceContainer.js`
- **Test Data Schema**: See YAML files in `Library/Data/tests/`
- **Mock Implementations**: See `Library/Tests/fixtures/mocks.js`
- **Assertion Framework**: See `Library/Tests/fixtures/assertions.js`

## When Asked to Improve Test Files

1. Review the existing test file structure
2. Identify whether it's a unit or integration test
3. Check for ServiceContainer usage
4. Identify missing or improper mock services
5. Check for dependency spelling errors (especially `textUtilities`)
6. Look for shared object reference issues
7. Add proper assertions and test structure
8. Ensure test data comes from fixtures
9. Ensure proper cleanup
10. Add documentation comments
11. Verify the test follows all patterns above
12. Run the test to verify it passes
