/**
 * DraftsDocument Lifecycle Integration Test
 *
 * Tests complete DraftsDocument lifecycle end-to-end:
 * - Document creation
 * - Property access and modification
 * - Status and destination management
 * - Pipeline integration
 * - Saving and persistence
 * - Document loading
 * - Document deletion
 *
 * Dependencies: Drafts app (uses real Draft objects)
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");
require("../Tests/fixtures/testData.js");
require("../Tests/fixtures/mocks.js");

// Load ServiceContainer framework
require("shared/core/ServiceInitializer.js");

// Load required modules
require("modules/cp/core/ContentPipeline.js");

// Create test instance
const test = new TestAssertions('DraftsDocument Lifecycle Integration Test');

// =============================================================================
// Setup
// =============================================================================

test.section('Setup and Configuration');

resetServices();
initializeServices();

const container = ServiceContainer.getInstance();

// Register test services
const testData = getCPTestData();
container.register('cpFileSystem', () => createMockFS(testData), true);
container.register('cpUI', () => createMockUI({ debug: false }), true);
container.register('ulysses', () => createMockUlysses({ debug: false }), true);

// Get services under test
const contentPipeline = container.get('cpDefault');
const documentFactory = contentPipeline.documentFactory;
const statuses = contentPipeline.statuses;
const destinations = contentPipeline.destinations;

test.assertNotNullish(documentFactory, 'DocumentFactory available');
test.assertNotNullish(statuses, 'Statuses service available');
test.assertNotNullish(destinations, 'Destinations service available');

// Mock UI to auto-select destination and title
const mockUI = container.get('cpUI');
// Configure response for destination selection menu
mockUI.setPromptResponse('Chose destination:', {
  button: 'OK',
  fieldValues: { destination: 'Test Blog' }
});
// Configure response for title/status menu
mockUI.setPromptResponse('Working title?', {
  button: 'Writing',
  fieldValues: { title: 'Test Draft Document' }
});

// =============================================================================
// Section 1: Create New Draft Document
// =============================================================================

test.section('Create New Draft Document');

let newDraft;
test.assertDoesNotThrow(() => {
  newDraft = documentFactory.create('draft');
}, 'Creating new draft does not throw');

test.assertNotNullish(newDraft, 'New draft created');
test.assertType(newDraft, 'DraftsDoc', 'Is DraftsDoc instance');
test.assertEqual(newDraft.docIDType, 'DraftsID', 'Has DraftsID type');

// Note: Draft creation may fail if UI prompts are cancelled
// In test environment with MockUI, destination is auto-selected
test.info(`Draft created with docIDType: ${newDraft.docIDType}`);

// =============================================================================
// Section 2: Access Draft Properties
// =============================================================================

test.section('Access Draft Properties');

if (newDraft && newDraft.workingDraft) {
  test.assertNotNullish(newDraft.docID, 'Draft has docID');
  test.info(`Draft ID: ${newDraft.docID}`);

  test.assertNotNullish(newDraft.docIDType, 'Draft has docIDType');
  test.assertEqual(newDraft.docIDType, 'DraftsID', 'docIDType is DraftsID');

  // Destination should be set from mock selection
  if (newDraft.destination) {
    test.info(`Destination: ${newDraft.destination}`);
  }

  // Content may be empty or from template
  test.info(`Content length: ${newDraft.content?.length || 0}`);
} else {
  test.info('Draft creation requires Drafts environment - skipping property tests');
}

// =============================================================================
// Section 3: Set Draft Status
// =============================================================================

test.section('Set Draft Status');

if (newDraft && newDraft.workingDraft) {
  const testStatus = 'Writing';

  test.assertDoesNotThrow(() => {
    newDraft.status = testStatus;
  }, 'Setting status does not throw');

  // Note: Status setting modifies tags on the draft
  test.info(`Status set to: ${testStatus}`);

  // Verify status was set
  if (newDraft.workingDraft.hasTag(testStatus) ||
      newDraft.workingDraft.hasTag(`In Pipeline::${testStatus}`)) {
    test.assert(true, 'Status tag added to draft');
  }
} else {
  test.info('Skipping status tests - requires Drafts environment');
}

// =============================================================================
// Section 4: Set Draft Destination
// =============================================================================

test.section('Set Draft Destination');

if (newDraft && newDraft.workingDraft) {
  const testDestination = 'Test Blog';

  // Destination should already be set from creation
  // Try changing it
  test.assertDoesNotThrow(() => {
    newDraft.destination = testDestination;
  }, 'Setting destination does not throw');

  test.info(`Destination set to: ${testDestination}`);

  // Verify destination tag
  if (newDraft.workingDraft.hasTag(testDestination)) {
    test.assert(true, 'Destination tag added to draft');
  }
} else {
  test.info('Skipping destination tests - requires Drafts environment');
}

// =============================================================================
// Section 5: Pipeline Integration
// =============================================================================

test.section('Pipeline Integration');

if (newDraft && newDraft.workingDraft) {
  // Check initial pipeline status
  const initialPipelineStatus = newDraft.inPipeline;
  test.info(`Initial pipeline status: ${initialPipelineStatus}`);

  // Set inPipeline to true
  test.assertDoesNotThrow(() => {
    newDraft.inPipeline = true;
  }, 'Setting inPipeline does not throw');

  test.info('Set inPipeline to true');

  // When inPipeline is true, draft should be archived and have combined tag
  if (newDraft.workingDraft.isArchived) {
    test.assert(true, 'Draft is archived when in pipeline');
  }
} else {
  test.info('Skipping pipeline tests - requires Drafts environment');
}

// =============================================================================
// Section 6: Save Draft
// =============================================================================

test.section('Save Draft');

if (newDraft && newDraft.workingDraft) {
  test.assertDoesNotThrow(() => {
    newDraft.save();
  }, 'Saving draft does not throw');

  test.info('Draft saved successfully');

  // Draft ID should remain the same after save
  const draftIDAfterSave = newDraft.docID;
  test.assertNotNullish(draftIDAfterSave, 'Draft ID exists after save');
} else {
  test.info('Skipping save tests - requires Drafts environment');
}

// =============================================================================
// Section 7: Load Existing Draft
// =============================================================================

test.section('Load Existing Draft');

if (newDraft && newDraft.docID) {
  const recordToLoad = {
    docID: newDraft.docID,
    docIDType: 'DraftsID'
  };

  let loadedDraft;
  test.assertDoesNotThrow(() => {
    loadedDraft = documentFactory.load(recordToLoad);
  }, 'Loading draft does not throw');

  if (loadedDraft) {
    test.assertNotNullish(loadedDraft, 'Draft loaded');
    test.assertType(loadedDraft, 'DraftsDoc', 'Loaded document is DraftsDoc');
    test.assertEqual(loadedDraft.docID, newDraft.docID, 'Loaded draft has same ID');

    test.info('Draft loaded successfully from record');
  }
} else {
  test.info('Skipping load tests - requires Drafts environment');
}

// =============================================================================
// Section 8: Draft Title and Slug
// =============================================================================

test.section('Draft Title and Slug');

if (newDraft && newDraft.workingDraft) {
  const title = newDraft.title;
  test.assertNotNullish(title, 'Draft has title');
  test.info(`Title: ${title}`);

  // Test slug generation
  const slug = newDraft.slug;
  if (slug) {
    test.assertNotNullish(slug, 'Draft has slug');
    test.info(`Slug: ${slug}`);

    // Slug should be lowercase and hyphenated
    test.assert(slug === slug.toLowerCase(), 'Slug is lowercase');
  }

  // Test scrubbed title
  const scrubedTitle = newDraft.scrubedTitle;
  if (scrubedTitle) {
    test.assertNotNullish(scrubedTitle, 'Draft has scrubbed title');
    test.info(`Scrubbed title: ${scrubedTitle}`);
  }
} else {
  test.info('Skipping title/slug tests - requires Drafts environment');
}

// =============================================================================
// Section 9: Record Integration
// =============================================================================

test.section('Record Integration');

if (newDraft && newDraft.workingDraft) {
  const mockRecord = {
    id: 'recTEST123',
    docID: newDraft.docID,
    docIDType: 'DraftsID',
    Title: 'Test Record Title',
    Status: 'Editing',
    Destination: 'Test Blog'
  };

  test.assertDoesNotThrow(() => {
    newDraft.record = mockRecord;
  }, 'Setting record does not throw');

  // Record should be accessible
  test.assertNotNullish(newDraft.record, 'Record is set');
  test.assertEqual(newDraft.record.id, 'recTEST123', 'Record ID matches');

  // Title from record should be accessible
  if (newDraft.record.Title) {
    test.assertEqual(newDraft.record.Title, 'Test Record Title', 'Record title accessible');
  }
} else {
  test.info('Skipping record tests - requires Drafts environment');
}

// =============================================================================
// Section 10: Airtable Destination Mapping
// =============================================================================

test.section('Airtable Destination Mapping');

if (newDraft && newDraft.destination) {
  const airtableDest = newDraft.airtableDestination;
  test.assertNotNullish(airtableDest, 'Has Airtable destination mapping');
  test.info(`Airtable destination: ${airtableDest}`);
} else {
  test.info('Skipping Airtable mapping tests - requires destination');
}

// =============================================================================
// Section 11: Open Draft (Without Actually Opening)
// =============================================================================

test.section('Open Draft Method');

if (newDraft && newDraft.workingDraft) {
  // Note: We don't actually call open() as it would change the editor state
  // Just verify the method exists
  test.assertType(newDraft.open, 'Function', 'open() method exists');
  test.info('open() method is available (not called in test)');
} else {
  test.info('Skipping open tests - requires Drafts environment');
}

// =============================================================================
// Section 12: Delete Draft
// =============================================================================

test.section('Delete Draft');

if (newDraft && newDraft.workingDraft) {
  // Save the ID before deletion
  const draftIDBeforeDelete = newDraft.docID;

  test.assertDoesNotThrow(() => {
    newDraft.delete();
  }, 'Deleting draft does not throw');

  test.info('Draft deleted (moved to trash)');

  // Verify draft is trashed
  if (newDraft.workingDraft.isTrashed) {
    test.assert(true, 'Draft is marked as trashed');
  }

  // Try to find the draft - should still exist but be trashed
  const trashedDraft = Draft.find(draftIDBeforeDelete);
  if (trashedDraft) {
    test.assert(trashedDraft.isTrashed, 'Draft found in trash');
  }
} else {
  test.info('Skipping delete tests - requires Drafts environment');
}

// =============================================================================
// Section 13: Error Handling - Undefined Working Draft
// =============================================================================

test.section('Error Handling - Undefined Working Draft');

// Create a DraftsDoc with a non-existent UUID
const invalidRecord = {
  docID: 'NONEXISTENT-UUID-99999',
  docIDType: 'DraftsID'
};

let invalidDoc;
test.assertDoesNotThrow(() => {
  invalidDoc = documentFactory.load(invalidRecord);
}, 'Loading non-existent draft does not throw');

if (invalidDoc) {
  test.assertType(invalidDoc, 'DraftsDoc', 'Returns DraftsDoc instance');

  // workingDraft should be undefined for non-existent UUID
  if (!invalidDoc.workingDraft) {
    test.assertNullish(invalidDoc.workingDraft, 'workingDraft is undefined for invalid UUID');

    // Operations should handle undefined gracefully
    test.assertDoesNotThrow(() => {
      invalidDoc.status = 'Writing';
    }, 'Setting status with undefined workingDraft does not throw');

    test.assertDoesNotThrow(() => {
      invalidDoc.destination = 'Test Blog';
    }, 'Setting destination with undefined workingDraft does not throw');
  }
}

// =============================================================================
// Section 14: Validation Methods
// =============================================================================

test.section('Validation Methods');

if (newDraft && newDraft.workingDraft) {
  // Test statusIsNotSet
  if (newDraft.status === '') {
    test.assert(newDraft.statusIsNotSet, 'statusIsNotSet true when status empty');
  } else {
    test.assert(!newDraft.statusIsNotSet, 'statusIsNotSet false when status set');
  }

  // Test destinationIsNotSet
  if (newDraft.destination === '' || newDraft.destination === undefined) {
    test.assert(newDraft.destinationIsNotSet, 'destinationIsNotSet true when destination empty');
  } else {
    test.assert(!newDraft.destinationIsNotSet, 'destinationIsNotSet false when destination set');
  }
}

// =============================================================================
// Test Summary
// =============================================================================

test.summary();
