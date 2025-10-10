# Standardize ServiceContainer Usage Across All Actions

## Objective

Standardize dependency injection across the entire codebase by ensuring all action files use ServiceContainer to obtain instances instead of direct instantiation. This provides consistent DI patterns, easier testing, and better resource management.

## Context

**Current State:**
- ServiceContainer exists and works well
- `ServiceFactories.js` defines service registration functions but they're never called
- Most action files still use direct instantiation: `new ContentPipeline()`, `new Team()`
- Singleton pattern has been implemented for core classes (ContentPipeline, BVR, Team)
- Some actions already updated (add-draft-to-pipeline.js, record-attendance.js)

**After Standardization:**
- All actions use ServiceContainer for dependency resolution
- ServiceInitializer.js provides one-time global setup
- Consistent pattern across all action files
- Services registered once, reused across actions
- Better testing (can mock services via container)

**Dependencies:**
- ✅ Singleton pattern implemented (ContentPipeline, BVR, Team)
- ✅ ServiceFactories.js updated with service registrations
- ✅ Ulysses and Airtable registered as singletons
- ⚠️ ServiceFactories.js never actually called (this prompt fixes that)

## Benefits

1. **Consistency**: One pattern for obtaining dependencies
2. **Testability**: Can register mock services for testing
3. **Performance**: Services reused via singleton registration
4. **Maintainability**: Single place to configure dependencies
5. **Flexibility**: Easy to swap implementations (e.g., TestDB instead of NocoDB)

## Architecture Overview

### Current Pattern (Inconsistent)

```javascript
// Some actions use direct instantiation
require("modules/cp/core/ContentPipeline.js");
const cp = new ContentPipeline();

// Some use getInstance()
const cp = ContentPipeline.getInstance();

// Some use Team directly
const team = new Team(teamID);
```

### Target Pattern (Standardized)

```javascript
// All actions use ServiceContainer
require("shared/core/ServiceInitializer.js");
initializeServices();

const container = ServiceContainer.getInstance();
const cp = container.get('contentPipeline');
const team = container.get('teamFactory')(teamID);
```

### Service Registration Strategy

Services are registered once at startup via `ServiceInitializer.js`:

- **ContentPipeline**: Registered as factory returning singleton per table
- **BVR**: Registered as singleton
- **Team**: Registered as factory returning singleton per teamID
- **Ulysses**: Registered as singleton (shared across all documents)
- **Airtable**: Registered as singleton
- **Settings, UI, FileSystem**: Already registered

## Implementation Steps

**IMPORTANT:** Commit changes after each logical group to maintain incremental progress.

### Commit Strategy

This refactoring follows an **incremental commit approach**:

- **4-5 commits total**: Setup → CP actions → BVR actions → NR actions → Tests
- **Commit after each action group**: Don't batch all actions into one commit
- **Use conventional commits**: `refactor(actions):`, `feat(core):`, `test:`
- **Test incrementally**: Run actions after each commit to validate

**Why this approach?**
- Can identify which action group introduced an issue
- Rollback specific action types if needed
- Reviewable in action-type chunks
- Track progress clearly

**Before you start:**
```bash
# Ensure working directory is clean
git status

# Create feature branch (recommended)
git checkout -b feature/standardize-servicecontainer

# Or work directly on dev
git checkout dev
```

---

### Step 0: Create ServiceInitializer

**File:** `Library/Scripts/shared/core/ServiceInitializer.js`

```javascript
/**
 * ServiceInitializer - Global service initialization
 *
 * This module initializes all services in the ServiceContainer.
 * Call initializeServices() once at the start of each action.
 *
 * The function is idempotent - safe to call multiple times.
 * Services are only registered once.
 */

if (typeof ServiceContainer == "undefined") {
  require("shared/core/ServiceContainer.js");
}
if (typeof setupBVRServices == "undefined") {
  require("shared/core/ServiceFactories.js");
}

/**
 * Initialize all services in the ServiceContainer
 * Safe to call multiple times - services only registered once
 */
function initializeServices() {
  const container = ServiceContainer.getInstance();

  // Check if already initialized
  if (container.has('servicesInitialized')) {
    console.log('[ServiceInitializer] Services already initialized, skipping');
    return;
  }

  console.log('[ServiceInitializer] Initializing all services...');

  // Initialize BVR and CP services
  setupBVRServices();
  setupContentPipelineServices();

  // Register ContentPipeline as a factory that returns singletons per table
  container.register('contentPipeline', (c) => {
    if (typeof ContentPipeline == "undefined") {
      require("modules/cp/core/ContentPipeline.js");
    }
    // Return factory function that creates/returns singleton per table
    return (table = "Content") => ContentPipeline.getInstance(table);
  }, true);

  // Register default ContentPipeline instance for convenience
  container.register('cpDefault', (c) => {
    if (typeof ContentPipeline == "undefined") {
      require("modules/cp/core/ContentPipeline.js");
    }
    return ContentPipeline.getInstance("Content");
  }, true);

  // Mark as initialized
  container.register('servicesInitialized', () => true, true);

  console.log('[ServiceInitializer] Services initialized successfully');
  console.log(`[ServiceInitializer] Registered services: ${container.getRegisteredServices().length}`);
}

/**
 * Reset all services (useful for testing)
 */
function resetServices() {
  const container = ServiceContainer.getInstance();
  container.reset();
  console.log('[ServiceInitializer] All services reset');
}
```

**Testing checkpoint:**
```javascript
// Test in a draft or test file
require("shared/core/ServiceInitializer.js");

initializeServices();
const container = ServiceContainer.getInstance();

// Verify services registered
console.log('Registered services:', container.getRegisteredServices());
console.log('Has cpDefault:', container.has('cpDefault'));
console.log('Has contentPipeline:', container.has('contentPipeline'));
console.log('Has bvr:', container.has('bvr'));
console.log('Has teamFactory:', container.has('teamFactory'));
```

**Commit after this step:**
```bash
git add Library/Scripts/shared/core/ServiceInitializer.js
git commit -m "feat(core): Add ServiceInitializer for global service setup

- Create centralized service initialization
- Call ServiceFactories setup functions
- Register ContentPipeline and convenience accessors
- Mark initialization state to prevent duplicate registration
- Add reset function for testing

This enables consistent ServiceContainer usage across all actions."
```

---

### Step 1: Update ContentPipeline Actions

**Files to update (9 files):**
- `Library/Actions/cp/add-draft-to-pipeline.js` ✅ (already updated)
- `Library/Actions/cp/add-sheet-to-pipeline.js`
- `Library/Actions/cp/beyond-the-book.js`
- `Library/Actions/cp/get-url.js`
- `Library/Actions/cp/sync-status-with-ulysses-id.js`
- `Library/Actions/cp/update-status-of-draft.js`
- `Library/Actions/cp/update-status-with-ulysses-id-v2.js`
- `Library/Actions/cp/update-status-with-ulysses-id-v3.js`
- `Library/Actions/cp/welcome.js`

**Pattern for updating:**

#### Before:
```javascript
// Content Pipeline Action
require("modules/cp/core/ContentPipeline.js");
const cp = new ContentPipeline();
cp.someMethod();
```

#### After:
```javascript
// Content Pipeline Action
require("shared/core/ServiceInitializer.js");
initializeServices();

const cp = ServiceContainer.getInstance().get('cpDefault');
cp.someMethod();
```

**Alternative pattern (if custom table needed):**
```javascript
require("shared/core/ServiceInitializer.js");
initializeServices();

const container = ServiceContainer.getInstance();
const cpFactory = container.get('contentPipeline');
const cp = cpFactory("Archive"); // Custom table
```

---

#### Example: add-sheet-to-pipeline.js

**Current (check file first):**
```javascript
require("modules/cp/core/ContentPipeline.js");
const cp = new ContentPipeline();
cp.addDefaultNotesToSheet(targetId);
```

**Updated:**
```javascript
require("shared/core/ServiceInitializer.js");
initializeServices();

const cp = ServiceContainer.getInstance().get('cpDefault');
cp.addDefaultNotesToSheet(targetId);
```

---

#### Example: welcome.js

**Current:**
```javascript
require("modules/cp/core/ContentPipeline.js");
const cp = new ContentPipeline();
cp.welcome();
```

**Updated:**
```javascript
require("shared/core/ServiceInitializer.js");
initializeServices();

const cp = ServiceContainer.getInstance().get('cpDefault');
cp.welcome();
```

---

#### Example: update-status-of-draft.js

**Current:**
```javascript
require("modules/cp/core/ContentPipeline.js");
const cp = new ContentPipeline();
cp.updateStatusOfDoc(draft.uuid, "DraftsID");
```

**Updated:**
```javascript
require("shared/core/ServiceInitializer.js");
initializeServices();

const cp = ServiceContainer.getInstance().get('cpDefault');
cp.updateStatusOfDoc(draft.uuid, "DraftsID");
```

---

**Apply this pattern to all CP actions.**

**Commit after this step:**
```bash
git add Library/Actions/cp/
git commit -m "refactor(actions): Standardize CP actions to use ServiceContainer

- Update all ContentPipeline actions to use ServiceInitializer
- Replace direct instantiation with container.get('cpDefault')
- Consistent pattern across all 9 CP action files
- Maintains backward compatibility (same public API)

Actions updated:
- add-sheet-to-pipeline.js
- beyond-the-book.js
- get-url.js
- sync-status-with-ulysses-id.js
- update-status-of-draft.js
- update-status-with-ulysses-id-v2.js
- update-status-with-ulysses-id-v3.js
- welcome.js

(add-draft-to-pipeline.js already updated previously)"
```

---

### Step 2: Update BVR Actions

**Files to update (13 files):**
- `Library/Actions/bvr/archive-notes.js`
- `Library/Actions/bvr/bvr-action-menu.js`
- `Library/Actions/bvr/create-game-day-tasks.js`
- `Library/Actions/bvr/create-welcome-letter.js`
- `Library/Actions/bvr/insert-player-name.js`
- `Library/Actions/bvr/migrate-current-season.js`
- `Library/Actions/bvr/practice-plan-create.js`
- `Library/Actions/bvr/practice-plan-load.js`
- `Library/Actions/bvr/record-attendance.js` ✅ (already updated)
- `Library/Actions/bvr/record-score.js`
- `Library/Actions/bvr/start-new-season.js`
- `Library/Actions/bvr/submit-game-report.js`
- `Library/Actions/bvr/update-roster.js`

**Pattern for updating:**

#### Before:
```javascript
if (typeof Team == "undefined") require("modules/bvr/core/Team.js");
const team = new Team(teamID);
team.someMethod();
```

#### After:
```javascript
require("shared/core/ServiceInitializer.js");
initializeServices();

const container = ServiceContainer.getInstance();
const team = container.get('teamFactory')(teamID);
team.someMethod();
```

---

#### Example: create-welcome-letter.js

**Current:**
```javascript
if (typeof Team == "undefined") require("modules/bvr/core/Team.js");
const team = new Team();
team.createWelcomeLetter();
```

**Updated:**
```javascript
require("shared/core/ServiceInitializer.js");
initializeServices();

const container = ServiceContainer.getInstance();
const team = container.get('teamFactory')(); // Empty string for default team
team.createWelcomeLetter();
```

---

#### Example: record-score.js

**Current:**
```javascript
const oneSecond = 10000;
const recentlyCreated = new Date() - draft.createdAt < oneSecond;
const teamID = recentlyCreated ? draft.content : "";

if (typeof Team == "undefined") require("modules/bvr/core/Team.js");
const team = new Team(teamID);
team.gameRecordResult();
```

**Updated:**
```javascript
const oneSecond = 10000;
const recentlyCreated = new Date() - draft.createdAt < oneSecond;
const teamID = recentlyCreated ? draft.content : "";

require("shared/core/ServiceInitializer.js");
initializeServices();

const container = ServiceContainer.getInstance();
const team = container.get('teamFactory')(teamID);
team.gameRecordResult();
```

---

#### Example: bvr-action-menu.js

**Current:**
```javascript
if (typeof Team == "undefined") require("modules/bvr/core/Team.js");
const team = new Team();

// Menu logic...
switch (action) {
  case "recordAttendance":
    team.takeAttendace();
    break;
  // etc.
}
```

**Updated:**
```javascript
require("shared/core/ServiceInitializer.js");
initializeServices();

const container = ServiceContainer.getInstance();
const team = container.get('teamFactory')();

// Menu logic...
switch (action) {
  case "recordAttendance":
    team.takeAttendace();
    break;
  // etc.
}
```

---

**Apply this pattern to all BVR actions.**

**Important notes:**
- `teamFactory` returns a function that takes teamID parameter
- Empty string or no parameter uses default team
- Don't include `delete team;` statements (singletons persist intentionally)

**Commit after this step:**
```bash
git add Library/Actions/bvr/
git commit -m "refactor(actions): Standardize BVR actions to use ServiceContainer

- Update all BVR/Team actions to use ServiceInitializer
- Replace direct instantiation with container.get('teamFactory')
- Use factory pattern for team instances (supports multiple teams)
- Remove 'delete team' statements (singletons persist intentionally)
- Consistent pattern across all 13 BVR action files

Actions updated:
- archive-notes.js
- bvr-action-menu.js
- create-game-day-tasks.js
- create-welcome-letter.js
- insert-player-name.js
- migrate-current-season.js
- practice-plan-create.js
- practice-plan-load.js
- record-score.js
- start-new-season.js
- submit-game-report.js
- update-roster.js

(record-attendance.js already updated previously)"
```

---

### Step 3: Update NR Actions (If Applicable)

**Files in NR directory (17 files):**
- `Library/Actions/nr/add-to-my-notebook.js`
- `Library/Actions/nr/add-to-spark-notes.js`
- `Library/Actions/nr/author-update.js`
- `Library/Actions/nr/file-as.js`
- `Library/Actions/nr/insert-md-characters.js`
- `Library/Actions/nr/insert-template-application.js`
- `Library/Actions/nr/insert-template.js`
- `Library/Actions/nr/items-to-pack.js`
- `Library/Actions/nr/kutt-test.js`
- `Library/Actions/nr/link-tools.js`
- `Library/Actions/nr/meat-inventory.js`
- `Library/Actions/nr/meat-remiders.js`
- `Library/Actions/nr/morning-pages.js`
- `Library/Actions/nr/new-meats.js`
- `Library/Actions/nr/pushover-message.js`
- `Library/Actions/nr/send-to-bear.js`
- `Library/Actions/nr/send-to-nextcloud.js`
- `Library/Actions/nr/send-to.js`

**Check each file first** to determine if it uses ContentPipeline, BVR, or Team:

```bash
# Check for CP/BVR/Team usage
grep -l "ContentPipeline\|new BVR\|new Team" Library/Actions/nr/*.js
```

**If files use CP/BVR/Team**, update them using the patterns from Steps 1-2.

**Example (if author-update.js uses CP):**

**Before:**
```javascript
require("modules/cp/core/ContentPipeline.js");
const cp = new ContentPipeline();
// ... use cp
```

**After:**
```javascript
require("shared/core/ServiceInitializer.js");
initializeServices();

const cp = ServiceContainer.getInstance().get('cpDefault');
// ... use cp
```

**Commit after this step (if changes made):**
```bash
git add Library/Actions/nr/
git commit -m "refactor(actions): Standardize NR actions to use ServiceContainer

- Update NR actions that use CP/BVR/Team
- Apply same ServiceContainer pattern as other actions
- Maintain consistency across entire actions directory

Actions updated: [list files that were actually modified]"
```

**If no NR actions need updating:**
Skip this commit and note in your summary that NR actions don't use CP/BVR/Team.

---

### Step 4: Update Internal Instantiations (If Any)

Check for any internal code that still uses direct instantiation:

```bash
# Search for direct instantiation patterns
grep -rn "new ContentPipeline()" Library/Scripts/modules/
grep -rn "new BVR()" Library/Scripts/modules/
grep -rn "new Team(" Library/Scripts/modules/

# Exclude ServiceFactories and test files
grep -rn "new ContentPipeline()" Library/Scripts/modules/ | grep -v "ServiceFactories" | grep -v "test"
```

**Files likely to have internal instantiations:**
- Test files in `Library/Scripts/cp/tests/`
- Test files in `Library/Scripts/bvr/tests/`
- `Library/Scripts/modules/bvr/core/Season.js` ✅ (already uses getInstance())

**For test files:**

It's acceptable for test files to use either pattern:
- `new ContentPipeline()` - For isolated testing
- `ContentPipeline.getInstance()` - For singleton testing
- ServiceContainer - For integration testing

**Decision:** Leave test files as-is unless they're causing issues. They're not production code.

**For non-test files:**

If found, update using the ServiceContainer pattern or getInstance() pattern.

**Commit if changes made:**
```bash
git add Library/Scripts/modules/
git commit -m "refactor(modules): Update internal instantiations to use getInstance()

- Replace remaining direct instantiation in module code
- Maintain consistency with singleton pattern
- Exclude test files (acceptable to use direct instantiation)

Files updated: [list files]"
```

---

### Step 5: Create Validation Tests

**File:** `Library/Tests/servicecontainer-standardization-test.js`

```javascript
/**
 * ServiceContainer Standardization Test
 *
 * Validates that ServiceContainer provides all needed services
 * and that actions can successfully use the container pattern.
 */

require("shared/core/ServiceInitializer.js");

console.log('=== ServiceContainer Standardization Test ===\n');

// Test 1: Initialize services
console.log('--- Test 1: Service Initialization ---');
try {
  initializeServices();
  console.log('initializeServices(): PASS ✅');
} catch (e) {
  console.log('initializeServices(): FAIL ❌', e.message);
}

// Test 2: Verify service registration
console.log('\n--- Test 2: Service Registration ---');
const container = ServiceContainer.getInstance();

const requiredServices = [
  'servicesInitialized',
  'cpDefault',
  'contentPipeline',
  'bvr',
  'teamFactory',
  'bvrSettings',
  'bvrUI',
  'cpSettings',
  'cpFileSystem',
  'cpUI',
  'textUtilities',
  'ulysses',
  'airtable'
];

requiredServices.forEach(service => {
  const exists = container.has(service);
  console.log(`${service}:`, exists ? 'PASS ✅' : 'FAIL ❌');
});

// Test 3: Get ContentPipeline via container
console.log('\n--- Test 3: Get ContentPipeline ---');
try {
  const cp = container.get('cpDefault');
  console.log('get cpDefault:', cp ? 'PASS ✅' : 'FAIL ❌');
  console.log('cpDefault is ContentPipeline:',
    cp.constructor.name === 'ContentPipeline' ? 'PASS ✅' : 'FAIL ❌');
} catch (e) {
  console.log('get cpDefault: FAIL ❌', e.message);
}

// Test 4: Get Team via factory
console.log('\n--- Test 4: Get Team via Factory ---');
try {
  const teamFactory = container.get('teamFactory');
  const team = teamFactory('test-team');
  console.log('get teamFactory:', teamFactory ? 'PASS ✅' : 'FAIL ❌');
  console.log('create team instance:', team ? 'PASS ✅' : 'FAIL ❌');
  console.log('team is Team:',
    team.constructor.name === 'Team' ? 'PASS ✅' : 'FAIL ❌');
} catch (e) {
  console.log('get teamFactory: FAIL ❌', e.message);
}

// Test 5: Get BVR singleton
console.log('\n--- Test 5: Get BVR Singleton ---');
try {
  const bvr1 = container.get('bvr');
  const bvr2 = container.get('bvr');
  console.log('get bvr:', bvr1 ? 'PASS ✅' : 'FAIL ❌');
  console.log('bvr is singleton:',
    bvr1 === bvr2 ? 'PASS ✅' : 'FAIL ❌');
} catch (e) {
  console.log('get bvr: FAIL ❌', e.message);
}

// Test 6: Get Ulysses singleton
console.log('\n--- Test 6: Get Ulysses Singleton ---');
try {
  const ulysses1 = container.get('ulysses');
  const ulysses2 = container.get('ulysses');
  console.log('get ulysses:', ulysses1 ? 'PASS ✅' : 'FAIL ❌');
  console.log('ulysses is singleton:',
    ulysses1 === ulysses2 ? 'PASS ✅' : 'FAIL ❌');
} catch (e) {
  console.log('get ulysses: FAIL ❌', e.message);
}

// Test 7: Idempotent initialization
console.log('\n--- Test 7: Idempotent Initialization ---');
try {
  initializeServices(); // Call again
  initializeServices(); // And again
  console.log('Multiple init calls: PASS ✅ (no errors thrown)');
} catch (e) {
  console.log('Multiple init calls: FAIL ❌', e.message);
}

// Test 8: Service count
console.log('\n--- Test 8: Service Count ---');
const registeredServices = container.getRegisteredServices();
console.log(`Total services registered: ${registeredServices.length}`);
console.log('Expected minimum: 13');
console.log('Service count check:',
  registeredServices.length >= 13 ? 'PASS ✅' : 'FAIL ❌');

console.log('\n=== ServiceContainer Standardization Tests Complete ===');
console.log('\nAll tests should show PASS ✅');
console.log('If any tests show FAIL ❌, review the service registration in ServiceInitializer.js');
```

**Run the test:**
```javascript
// In a Drafts action or test runner
require("Tests/servicecontainer-standardization-test.js");
```

**Commit after creating tests:**
```bash
git add Library/Tests/servicecontainer-standardization-test.js
git commit -m "test: Add ServiceContainer standardization validation tests

- Create comprehensive test suite for service registration
- Validate all required services present
- Test singleton behavior for shared services
- Verify factory pattern for Team instances
- Test idempotent initialization
- Check service count meets minimum requirements

Run this test to validate ServiceContainer setup across the codebase."
```

---

## Testing & Validation

### Integration Testing

After completing all steps, test each type of action:

**ContentPipeline Actions:**
```
1. Run: add-draft-to-pipeline
   - Create a test draft
   - Run the action
   - Verify draft added to pipeline
   - Check console for "[ServiceInitializer]" messages

2. Run: welcome
   - Run the action
   - Verify recent documents shown
   - Select a document and perform an action

3. Run: update-status-of-draft
   - Open a draft in pipeline
   - Run the action
   - Verify status update works
```

**BVR Actions:**
```
1. Run: record-attendance
   - Create draft with team ID or leave blank
   - Run the action
   - Verify attendance recording works

2. Run: create-welcome-letter
   - Run the action
   - Verify welcome letter created

3. Run: record-score
   - Create game report draft
   - Run the action
   - Verify score recording works
```

**Check Console Output:**

Look for these messages indicating proper ServiceContainer usage:
```
[ServiceInitializer] Initializing all services...
[ServiceInitializer] Services initialized successfully
[ServiceInitializer] Registered services: 15
[ContentPipeline] Reusing singleton instance for table: Content
[Team] Reusing singleton instance for team: varsity
```

### Validation Checklist

Before considering complete:

- ✅ ServiceInitializer.js created and working
- ✅ All CP actions (9 files) use ServiceContainer
- ✅ All BVR actions (13 files) use ServiceContainer
- ✅ NR actions checked and updated if needed
- ✅ Validation test created and passing
- ✅ Integration tests pass (sample actions work)
- ✅ Console shows service initialization messages
- ✅ No direct instantiation in production action files
- ✅ Singleton behavior verified (services reused)
- ✅ All commits made with descriptive messages

---

## Git Workflow Summary

Throughout this standardization, you will make **4-5 commits**:

1. ✅ **Step 0**: Create ServiceInitializer
2. ✅ **Step 1**: Update CP actions (9 files)
3. ✅ **Step 2**: Update BVR actions (13 files)
4. ✅ **Step 3**: Update NR actions (if applicable)
5. ✅ **Step 5**: Add validation tests

**View your work:**
```bash
# View commit history
git log --oneline -5

# View files changed
git diff HEAD~5..HEAD --name-only

# View specific action changes
git diff HEAD~3 Library/Actions/cp/welcome.js
```

**Expected commit history:**
```
a1b2c3d test: Add ServiceContainer standardization validation tests
e4f5g6h refactor(actions): Standardize BVR actions to use ServiceContainer
i7j8k9l refactor(actions): Standardize CP actions to use ServiceContainer
m0n1o2p feat(core): Add ServiceInitializer for global service setup
```

**Push to remote:**
```bash
# Review all changes
git diff origin/dev..HEAD

# Push feature branch
git push origin feature/standardize-servicecontainer

# Or push to dev
git push origin dev
```

---

## Rollback Plan

If issues arise:

### Option 1: Revert Specific Step
```bash
# Revert just BVR actions
git log --oneline -5
git revert <commit-hash-of-bvr-actions>
```

### Option 2: Reset to Before Standardization
```bash
# Reset to before all changes
git reset --hard HEAD~5

# Preserve work in backup branch first
git branch backup-servicecontainer-work
git reset --hard HEAD~5
```

### Option 3: Roll Forward with Fixes
```bash
# If one action is problematic, fix it
git add Library/Actions/cp/problematic-action.js
git commit -m "fix(actions): Correct ServiceContainer usage in problematic-action"
```

### Why Rollback is Safe

1. **Public APIs unchanged**: Actions still call same methods
2. **Backward compatible**: Direct instantiation still works (with deprecation warning)
3. **Incremental commits**: Can rollback specific action groups
4. **Well-tested**: Singleton pattern already validated

---

## Expected Outcomes

After implementation:

1. **Consistency**: All 22+ action files use identical DI pattern
2. **Performance**: Services reused across actions (60-70% memory savings)
3. **Testability**: Can mock services for testing
4. **Maintainability**: Single place to configure all services
5. **Clarity**: Clear, predictable dependency resolution

**Memory Impact:**
```
Before: Each action creates new instances
- 9 CP actions × new ContentPipeline() = 9 instances
- 13 BVR actions × new Team() = 13+ instances

After: All actions share singletons
- 1 ContentPipeline per table (typically 1)
- 1 Team per teamID (typically 1-3)
- 1 Ulysses instance total
- 1 BVR instance total

Result: ~70-80% reduction in duplicate instantiation
```

---

## Troubleshooting

### Issue: "ServiceContainer is not defined"

**Cause:** ServiceInitializer.js not required properly

**Fix:**
```javascript
// Add at top of action file
require("shared/core/ServiceInitializer.js");
```

---

### Issue: "Service 'cpDefault' is not registered"

**Cause:** initializeServices() not called

**Fix:**
```javascript
require("shared/core/ServiceInitializer.js");
initializeServices(); // Must call this!
```

---

### Issue: "Cannot read property 'get' of undefined"

**Cause:** ServiceContainer.getInstance() returns undefined

**Fix:**
```javascript
// Ensure ServiceContainer loaded
if (typeof ServiceContainer == "undefined") {
  require("shared/core/ServiceContainer.js");
}
const container = ServiceContainer.getInstance();
```

---

### Issue: Action throws deprecation warning

**Cause:** Some code path still using direct instantiation

**Fix:** Search action file for:
```javascript
// Find these patterns and replace
new ContentPipeline()  // Replace with container.get('cpDefault')
new Team()             // Replace with container.get('teamFactory')()
new BVR()              // Replace with container.get('bvr')
```

---

### Issue: "TeamFactory is not a function"

**Cause:** Trying to use teamFactory directly instead of calling it

**Fix:**
```javascript
// Wrong:
const team = container.get('teamFactory');

// Right:
const team = container.get('teamFactory')(teamID);
```

---

## Next Steps

After standardizing ServiceContainer usage:

1. **Remove deprecation warnings** from constructors (optional, future task)
2. **Add more services** to container (e.g., Sport, Season)
3. **Create testing guide** showing how to mock services
4. **Document service registration** patterns for future developers
5. **Consider making constructors private** (breaking change, requires careful planning)

---

## Reference: Service Names

Quick reference for service access:

| Service | Access Pattern | Returns |
|---------|---------------|---------|
| ContentPipeline (default) | `container.get('cpDefault')` | ContentPipeline instance for "Content" table |
| ContentPipeline (custom) | `container.get('contentPipeline')(table)` | ContentPipeline instance for custom table |
| BVR | `container.get('bvr')` | BVR singleton instance |
| Team | `container.get('teamFactory')(teamID)` | Team instance for specific team |
| Ulysses | `container.get('ulysses')` | Ulysses singleton instance |
| Airtable | `container.get('airtable')` | Airtable singleton instance |
| Settings (CP) | `container.get('cpSettings')` | CP Settings instance |
| Settings (BVR) | `container.get('bvrSettings')` | BVR Settings instance |
| UI (CP) | `container.get('cpUI')` | CP UI instance |
| UI (BVR) | `container.get('bvrUI')` | BVR UI instance |

---

## Summary

This standardization:
- **High value**: Consistent DI pattern, 70-80% memory savings
- **Low risk**: Backward compatible, incremental rollout
- **Clear benefits**: Better testing, maintainability, performance
- **Well-tested**: Built on validated singleton pattern

The result is a clean, consistent architecture where all actions follow the same pattern for obtaining dependencies, making the codebase easier to understand, test, and maintain.
