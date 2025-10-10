# Writing Integration Tests for Drafts Scripts

## Context

This prompt guides the creation and maintenance of integration tests for the Drafts scripts project. Use the patterns and lessons learned from successful test implementations, particularly the Content Pipeline document conversion tests.

## Test Structure and Organization

### File Locations
- **Integration tests**: `Library/Tests/integration/{module}/{test-name}-test.js`
- **Unit tests**: `Library/Tests/unit/{module}/{test-name}-test.js`
- **Test fixtures**: `Library/Tests/fixtures/`
  - `assertions.js` - TestAssertions framework
  - `testData.js` - Shared test data and scenarios
  - `mocks.js` - Mock service implementations

### Test File Template

```javascript
/**
 * {Test Name} Integration Test
 *
 * {Brief description of what this test validates}
 * {Any special notes about the test approach}
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");
require("../Tests/fixtures/mocks.js");

// Load ServiceContainer framework (if using)
require("shared/core/ServiceInitializer.js");

// Load required modules
require("modules/{module}/core/{Class}.js");
// ... other requires

// Load test implementations
require("modules/{module}/databases/TestDB.js");
require("modules/{module}/filesystems/TestFS.js");

// Create test instance
const test = new TestAssertions('{Test Name} Integration Test');

// Test sections follow...
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
  ui: mockUI,                    // Use createMockUI()
  fileSystem: mockFS,            // Use TestFS or MockFileSystem
  settings: settings,            // Test-specific settings object
  tableName: 'table1',           // Or appropriate table name
  textUtilities: textUtilities,  // New TextUtilities() - Note spelling!
  ulysses: mockUlysses,          // Use createMockUlysses() - NEVER real Ulysses
  defaultTag: settings.defaultTag,
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

## Mock Service Implementations

### When to Create Mocks

Create mock implementations for:
- External app integrations (Ulysses, Bear, etc.)
- Network/API calls (Airtable, NocoDB)
- File system operations (use TestFS or MockFileSystem)
- UI interactions (use MockUI)

### Mock Service Requirements

A proper mock must:

1. **Implement all methods used by the code under test**
   ```javascript
   class MockUlysses {
     newSheet(content, groupID) { /* ... */ }
     readSheet(sheetId) { /* ... */ }
     attachKeywords(sheetId, keywords) { /* ... */ }
     // ... all other methods
   }
   ```

2. **Return properly structured objects**
   ```javascript
   newSheet(content, groupID) {
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
     return sheet;
   }
   ```

3. **Track operations for assertions**
   ```javascript
   newSheet(content, groupID) {
     this.operations.push({ type: 'newSheet', content, groupID });
     // ... implementation
   }
   ```

4. **Handle error states**
   ```javascript
   readSheet(sheetId) {
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

## Assertion Patterns

### Test Creation Without Errors

```javascript
let newDoc;
test.assertDoesNotThrow(() => {
  newDoc = documentFactory.create('sheet');
}, 'DocumentFactory creates sheet without error');
```

### Verify Object State

```javascript
test.assertNotNullish(newDoc, 'New sheet document created');
test.assertType(newDoc, 'UlyssesDoc', 'Created document is UlyssesDoc type');
```

### Verify Property Transfer

```javascript
test.assertEqual(newDoc.status, sourceStatus, 'Status transferred correctly');
test.assertEqual(newDoc.destination, sourceDestination, 'Destination transferred correctly');
test.assertEqual(newDoc.content, sourceContent, 'Content transferred correctly');
```

### Verify Persistence

```javascript
test.assertDoesNotThrow(() => {
  newDoc.save();
}, 'Sheet document saves without error');

test.assertNotNullish(newDoc.docID, 'Sheet has docID after save');
```

## Common Test Scenarios

### Testing Document Conversion

```javascript
// 1. Load source document
const record = { docID: sourceId, docIDType: 'DraftsID' };
let sourceDoc = documentFactory.load(record);

// 2. Extract properties (cache them!)
const sourceStatus = sourceDoc.status;
const sourceDestination = sourceDoc.destination;
const sourceContent = sourceDoc.content;

// 3. Create target document
let targetDoc = documentFactory.create('sheet');

// 4. Transfer properties
targetDoc.status = sourceStatus;
targetDoc.destination = sourceDestination;
targetDoc.content = sourceContent;

// 5. Save target document
targetDoc.save();

// 6. Verify conversion (use cached values!)
test.assert(targetDoc.docID !== sourceDoc.docID, 'Different docID');
test.assertEqual(targetDoc.status, sourceStatus, 'Status preserved');
```

### Testing Document Lifecycle

```javascript
// Create
let doc = documentFactory.create('draft');
test.assertNotNullish(doc, 'Document created');

// Modify
doc.status = 'Writing';
doc.destination = 'Test Blog';
doc.content = 'Test content';

// Save
test.assertDoesNotThrow(() => doc.save(), 'Document saves');
test.assertNotNullish(doc.docID, 'Has docID after save');

// Load
const loadedDoc = documentFactory.load({
  docID: doc.docID,
  docIDType: doc.docIDType
});
test.assertEqual(loadedDoc.status, 'Writing', 'Status persisted');

// Delete
test.assertDoesNotThrow(() => doc.delete(), 'Document deletes');
```

## Integration Test Checklist

Before submitting an integration test, verify:

- [ ] Uses mock services for all external dependencies (Ulysses, Bear, etc.)
- [ ] All dependencies spelled correctly (`textUtilities`, not `textUltilities`)
- [ ] Includes all required dependencies (ui, fileSystem, settings, tableName, textUtilities, defaultTag)
- [ ] Caches values before modifying shared objects
- [ ] Uses actual class names in type assertions
- [ ] Has clear section headers
- [ ] Includes info messages for key values
- [ ] Documents non-obvious behavior
- [ ] Uses assertDoesNotThrow for operations that might fail
- [ ] Verifies results after state changes
- [ ] Cleans up test data
- [ ] Ends with test.summary()

## Migration Strategy

When migrating existing test files:

1. **Add test infrastructure**
   ```javascript
   require("../Tests/fixtures/assertions.js");
   require("../Tests/fixtures/testData.js");
   require("../Tests/fixtures/mocks.js");
   ```

2. **Replace alert() with assertions**
   ```javascript
   // Before
   alert(newDoc.docID);

   // After
   test.assertNotNullish(newDoc.docID, 'Document has docID');
   test.info(`Document ID: ${newDoc.docID}`);
   ```

3. **Add section headers**
   ```javascript
   test.section('Create Document');
   // ... creation code

   test.section('Verify Properties');
   // ... assertions
   ```

4. **Replace real services with mocks**
   ```javascript
   // Before
   const ulysses = new Ulysses();

   // After
   const mockUlysses = createMockUlysses({ debug: true });
   ```

5. **Add summary**
   ```javascript
   test.summary();  // Throws if any test failed
   ```

## Example: Complete Integration Test

See `Library/Tests/integration/cp/convert-draft-to-sheet-test.js` for a complete, working example that demonstrates all these patterns.

## Tasks

When asked to improve test files:

1. Review the existing test file structure
2. Identify missing mock services
3. Check for dependency spelling errors
4. Look for shared object reference issues
5. Add proper assertions and test structure
6. Ensure proper cleanup
7. Add documentation comments
8. Verify the test follows all patterns above
9. Run the test to verify it passes
