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
