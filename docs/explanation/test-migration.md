# Test Migration Plan - Phase 1

## Overview
This document tracks the migration of existing tests to the new standardized structure with ServiceContainer pattern, TestAssertions framework, and centralized test data.

## Current State

### ✅ Infrastructure Complete
- [x] Directory structure (`unit/`, `integration/`, `fixtures/`)
- [x] TestAssertions framework (`fixtures/assertions.js`)
- [x] Test data loader (`fixtures/testData.js`)
- [x] Mock services (`fixtures/mocks.js`)
- [x] Test data YAML (`Library/Data/tests/cp-test-data.yaml`)
- [x] Gulpfile YAML → JSON conversion

### ✅ Modern Tests (Already Compliant)
- `Library/Tests/unit/cp/text-utilities-test.js` - TextUtilities unit test
- `Library/Tests/integration/cp/convert-draft-to-sheet-test.js` - Document conversion test

## Tests To Migrate

### Category 1: Old CP Tests (Library/Tests/cp/) - 16 files

#### High Priority - Convert to Integration Tests
1. **add-draft-to-pipeline.js** → `integration/cp/add-draft-to-pipeline-test.js`
   - Tests end-to-end workflow of adding a draft to the pipeline
   - Needs: ServiceContainer, MockDatabase, MockUI, assertions

2. **convert-draft-to-sheet.js** → Already exists in new structure ✅
   - Check if old version can be deleted

3. **open-documents.js** → `integration/cp/open-documents-test.js`
   - Tests document opening workflow
   - Needs: ServiceContainer, DocumentFactory, assertions

4. **in-pipeline.js** → `integration/cp/in-pipeline-workflow-test.js`
   - Tests checking if document is in pipeline
   - Needs: ServiceContainer, MockDatabase, assertions

5. **save-recent-documents.js** → `integration/cp/recent-records-test.js`
   - Tests RecentRecords caching functionality
   - Needs: ServiceContainer, MockDatabase, assertions

#### High Priority - Convert to Unit Tests
6. **titleCase.js** → Already covered by text-utilities-test.js ✅
   - Check if old version can be deleted

7. **select-status.js** → `unit/cp/statuses-selection-test.js`
   - Tests Statuses.select() in isolation
   - Needs: ServiceContainer, MockUI, assertions

8. **select-destination.js** → `unit/cp/destinations-selection-test.js`
   - Tests Destinations.select() in isolation
   - Needs: ServiceContainer, MockUI, MockFS, assertions

#### Medium Priority - Database Connection Tests
9. **airtable-connect.js** → `integration/cp/airtable-connection-test.js`
   - Tests AirTableDB connectivity
   - Note: May need to mock or skip in automated tests (requires real credentials)

10. **nocodb-connect.js** → `integration/cp/nocodb-connection-test.js`
    - Tests NocoDBDB connectivity
    - Note: May need to mock or skip in automated tests

11. **airtable-extend-ATRecord.js** → Consider archiving (specific implementation test)

#### Medium Priority - Document Type Tests
12. **new-document-drafts.js** → `integration/cp/drafts-doc-lifecycle-test.js`
    - Tests DraftsDoc creation and lifecycle
    - Needs: ServiceContainer, DocumentFactory, assertions

13. **new-document-ulysses.js** → `integration/cp/ulysses-doc-lifecycle-test.js`
    - Tests UlyssesDoc creation and lifecycle
    - Needs: ServiceContainer, MockUlysses, assertions

14. **ulysses-doc.js** → May be redundant with above

#### Low Priority - Settings and Misc
15. **test-settingsv2.js** → `unit/cp/settings-test.js`
    - Tests settings loading and validation
    - Needs: ServiceContainer, assertions

16. **welcome.js** → Archive (manual/interactive test of welcome screen)

### Category 2: Root-Level Tests (Library/Tests/*.js) - 6 files

#### Keep/Migrate
1. **servicecontainer-standardization-test.js** → `unit/shared/servicecontainer-validation-test.js`
   - Already has console assertions
   - Convert to use TestAssertions framework
   - Tests ServiceContainer registration

2. **manager-extraction-test.js** → Archive (one-time refactoring validation)
   - Document that it was a validation test for the manager extraction refactor
   - Keep for historical reference but mark as deprecated

#### Archive/Remove
3. **singleton-memory-test.js** → Archive (experimental)
4. **singleton-memory-test-simple.js** → Archive (experimental)
5. **singleton-test-inline.js** → Archive (experimental)
6. **singleton-validation-test.js** → Archive (experimental)
   - These were experiments with singleton patterns
   - Not regular tests, can be archived

## Migration Priority Order

### Phase 1A: High-Value Integration Tests (Week 1)
1. `add-draft-to-pipeline-test.js` - Core workflow
2. `open-documents-test.js` - Common operation
3. `in-pipeline-workflow-test.js` - Essential check
4. `recent-records-test.js` - Caching layer

### Phase 1B: High-Value Unit Tests (Week 1)
5. `statuses-selection-test.js` - Core component
6. `destinations-selection-test.js` - Core component

### Phase 1C: Document Lifecycle Tests (Week 2)
7. `drafts-doc-lifecycle-test.js` - Document type
8. `ulysses-doc-lifecycle-test.js` - Document type

### Phase 1D: Database Tests (Week 2)
9. `airtable-connection-test.js` - Database layer
10. `nocodb-connection-test.js` - Database layer

### Phase 1E: Cleanup (Week 2)
11. Convert `servicecontainer-standardization-test.js`
12. Archive obsolete/experimental tests
13. Update all test wrapper files
14. Create README.md documentation

## Test Wrapper Files (Library/Scripts/cp/tests/)

These files map Drafts actions to test files and need to be updated when tests are moved:

- [x] `convert-draft-to-sheet.js` - Already points to new location
- [ ] `add-draft-to-pipeline.js` - Update after migration
- [ ] `open-documents.js` - Update after migration
- [ ] `in-pipeline.js` - Update after migration
- [ ] `save-recent-documents.js` - Update after migration
- [ ] `select-status.js` - Update after migration
- [ ] `select-destination.js` - Update after migration
- [ ] `airtable-connect.js` - Update after migration
- [ ] `nocodb-connect.js` - Update after migration
- [ ] `new-document-drafts.js` - Update after migration
- [ ] `new-document-ulysses.js` - Update after migration
- [ ] `titleCase.js` - Update after migration
- [ ] `test-settingsv2.js` - Update after migration
- [ ] `ulysses-doc.js` - Update after migration
- [ ] `welcome.js` - Archive or update
- [ ] `airtable-extend-ATRecord.js` - Archive or update

## Success Criteria

- [ ] All high-priority tests migrated and passing
- [ ] All tests use ServiceContainer pattern
- [ ] All tests use TestAssertions framework
- [ ] All tests use standardized test data
- [ ] All test wrappers updated
- [ ] README.md created with test guide
- [ ] Old tests archived or deleted
- [ ] Documentation updated

## Notes

- Use existing `convert-draft-to-sheet-test.js` as template for integration tests
- Use existing `text-utilities-test.js` as template for unit tests
- Follow patterns from `testing-guide.md`
- Always use MockUlysses, never real Ulysses
- Always use `textUtilities`, not `textUltilities` (typo!)
- Cache values before modifying shared objects in tests

---

# Phase 2: Expand Test Coverage (COMPLETED)

## Overview
Phase 2 focused on creating NEW comprehensive tests for areas not covered by existing tests. This phase goes beyond migrating old tests to create thorough test coverage for core components.

## ✅ Completed Phase 2 Tests

### Unit Tests

#### 1. ServiceContainer Comprehensive Tests ✅
**File**: `Library/Tests/unit/shared/servicecontainer-test.js`

**Coverage**:
- ✅ Singleton instance behavior
- ✅ Service registration (singleton vs factory)
- ✅ Lazy instantiation
- ✅ Dependency resolution and injection
- ✅ Complex dependency chains
- ✅ Error handling for missing services
- ✅ Error handling for invalid factories
- ✅ Reset functionality (full reset and singletons only)
- ✅ Re-registration behavior
- ✅ Instance registration (registerInstance)
- ✅ Service existence checks (has)
- ✅ Unregister functionality
- ✅ Getting all registered services
- ✅ Mixed singleton and factory services
- ✅ Edge cases (null/undefined returns, primitive returns, function returns)

**Test Coverage**: 15 sections, 100+ assertions

---

#### 2. DocumentFactory Unit Tests ✅
**File**: `Library/Tests/unit/cp/document-factory-test.js`

**Coverage**:
- ✅ Loading documents by docIDType (DraftsID, UlyssesID, BearID, TestID)
- ✅ Creating documents by type (draft, sheet, note)
- ✅ Case-insensitive type handling
- ✅ Error handling for missing docIDType
- ✅ Error handling for invalid docIDType
- ✅ Error handling for invalid create types
- ✅ Document properties after load
- ✅ Multiple document instance creation
- ✅ Document type mapping verification
- ✅ Edge cases (extra fields, null docID)

**Test Coverage**: 14 sections, 50+ assertions

---

#### 3. MockUI Comprehensive Tests ✅
**File**: `Library/Tests/unit/shared/mockui-test.js`

**Coverage**:
- ✅ MockUI creation and initialization
- ✅ Display prompt with default values
- ✅ Display prompt without defaults
- ✅ Display error messages
- ✅ Display success messages
- ✅ Display menu with default selection
- ✅ Display menu without default (first option)
- ✅ Interaction tracking by type
- ✅ Clear interactions
- ✅ Debug mode functionality
- ✅ Multiple MockUI instances (independence)
- ✅ Complex menu configurations
- ✅ Edge cases (empty configs, empty options)
- ✅ Interaction data integrity
- ✅ No side effects on passed configurations
- ✅ Interaction order preservation

**Test Coverage**: 17 sections, 60+ assertions

---

### Integration Tests

#### 4. DraftsDocument Lifecycle Tests ✅
**File**: `Library/Tests/integration/cp/drafts-document-lifecycle-test.js`

**Coverage**:
- ✅ Create new draft document
- ✅ Access draft properties (docID, docIDType, title, content)
- ✅ Set draft status
- ✅ Set draft destination
- ✅ Pipeline integration (inPipeline flag)
- ✅ Save draft
- ✅ Load existing draft by docID
- ✅ Draft title and slug generation
- ✅ Scrubbed title generation
- ✅ Record integration
- ✅ Airtable destination mapping
- ✅ Open draft method
- ✅ Delete draft (trash)
- ✅ Error handling for undefined working draft
- ✅ Validation methods (statusIsNotSet, destinationIsNotSet)

**Test Coverage**: 14 sections, 40+ assertions

---

#### 5. UlyssesDocument Lifecycle Tests ✅
**File**: `Library/Tests/integration/cp/ulysses-document-lifecycle-test.js`

**Coverage**:
- ✅ Create new Ulysses document (sheet)
- ✅ Set sheet properties before save
- ✅ Save sheet to Ulysses (MockUlysses)
- ✅ Verify keywords attached on save
- ✅ Verify default notes attached (excerpt, callback links)
- ✅ Load existing sheet by docID
- ✅ Update sheet status (keyword management)
- ✅ Update sheet destination (keyword management)
- ✅ Sheet title and slug generation
- ✅ Pipeline integration (inPipeline flag)
- ✅ Record integration
- ✅ Airtable destination mapping
- ✅ Open sheet method
- ✅ Delete sheet (trash)
- ✅ Error handling for save without properties
- ✅ Validation methods (statusIsNotSet, destinationIsNotSet)
- ✅ UlyssesID accessor
- ✅ Error handling for Ulysses errors
- ✅ Multiple save calls behavior

**Test Coverage**: 19 sections, 70+ assertions

**Note**: ALWAYS uses MockUlysses, never real Ulysses (prevents x-callback-url issues)

---

#### 6. RecentRecords Caching Tests ✅
**File**: `Library/Tests/integration/cp/recent-records-test.js`

**Coverage**:
- ✅ Initial load from file system
- ✅ Save document to recent records
- ✅ Save multiple documents (ordering verification)
- ✅ Update existing document (no duplicates)
- ✅ Cache size limit (15 records max)
- ✅ Delete document from recent records
- ✅ Error handling for save with missing title
- ✅ Error handling for delete with undefined doc
- ✅ Select record by index
- ✅ Select invalid index (returns undefined)
- ✅ RecentRecord wrapper class - DraftsID detection (old format)
- ✅ RecentRecord wrapper class - UlyssesID detection (old format)
- ✅ RecentRecord wrapper class - new format (docID/docIDType)
- ✅ All records access (multi-table support)
- ✅ File system write verification
- ✅ Database fallback when cache file missing
- ✅ Null record filtering

**Test Coverage**: 17 sections, 60+ assertions

---

#### 7. ContentPipeline Workflow Tests ✅
**File**: `Library/Tests/integration/cp/pipeline-workflow-test.js`

**Coverage**:
- ✅ Verify pipeline components initialized
- ✅ Workflow: Create new draft document
- ✅ Workflow: Set document status
- ✅ Workflow: Add to pipeline (mark as in pipeline)
- ✅ Workflow: Save to recent records
- ✅ Workflow: Update document status
- ✅ Workflow: Create Ulysses sheet
- ✅ Workflow: Save sheet to Ulysses
- ✅ Workflow: Add sheet to pipeline
- ✅ Workflow: Save sheet to recent records
- ✅ Workflow: Load document from recent records
- ✅ Workflow: Change document destination
- ✅ Workflow: Status progression (Developing → Drafting → Writing → Editing → Polishing)
- ✅ Validation: Invalid status handling
- ✅ Validation: Invalid destination handling
- ✅ Workflow: Document conversion (reference to dedicated test)
- ✅ Workflow: Delete from pipeline
- ✅ Workflow: Multiple documents in pipeline
- ✅ End-to-end workflow summary

**Test Coverage**: 19 sections, 50+ assertions

---

## Phase 2 Test Statistics

### Total Tests Created: 7 comprehensive test files

**Unit Tests**: 3 files
- ServiceContainer: 100+ assertions
- DocumentFactory: 50+ assertions
- MockUI: 60+ assertions

**Integration Tests**: 4 files
- DraftsDocument Lifecycle: 40+ assertions
- UlyssesDocument Lifecycle: 70+ assertions
- RecentRecords: 60+ assertions
- ContentPipeline Workflows: 50+ assertions

**Total Assertions**: 430+ assertions across all Phase 2 tests

---

## Phase 2 Benefits

1. **Comprehensive Coverage**: Every major component now has thorough test coverage
2. **Regression Prevention**: New tests catch issues early in development
3. **Documentation**: Tests serve as living documentation of how components work
4. **Refactoring Safety**: Comprehensive tests enable safe refactoring
5. **Quality Assurance**: High confidence in core functionality

---

## Not Implemented (Lower Priority)

- **BearDocument lifecycle tests** - Lower priority (less commonly used)
- **Database connection tests** (AirTableDB, NocoDBDB) - Require real credentials or advanced mocking

These can be added in future phases if needed.

---

## Next Steps (Future Phases)

### Phase 3: Complete Phase 1 Migration (Optional)
- Migrate remaining old tests from `Library/Tests/cp/` to new structure
- Update test wrapper files
- Archive obsolete tests

### Phase 4: Performance and Edge Case Tests (Optional)
- Load testing for large datasets
- Stress testing for concurrent operations
- More edge cases and error scenarios

### Phase 5: Continuous Integration (Optional)
- Set up automated test running
- Test result reporting
- Coverage metrics
