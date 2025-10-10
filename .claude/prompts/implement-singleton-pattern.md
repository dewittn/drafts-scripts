# Implement Singleton Pattern for Core Classes

## Objective

Implement the singleton pattern for main framework classes to reduce memory overhead by 60-70% across repeated action executions. Testing has confirmed that JavaScript memory persists between Drafts action runs, making singleton optimization highly beneficial.

## Context

The codebase analysis (see previous reports) identified that every Drafts action creates new instances of heavyweight classes (ContentPipeline, BVR, Team), causing significant memory overhead. Each instantiation triggers cascading dependency creation:

- `ContentPipeline` → ServiceContainer → DependencyProvider → Settings, UI, FileSystem, etc.
- `Team` → ServiceContainer → BVR → Settings, UI, etc.
- `UlyssesDocument` → new Ulysses() per document

**Test Results:** Memory persistence tests confirmed that singleton instances will persist across action runs, validating the 60-70% memory reduction estimate.

## Scope

Implement singleton pattern for these classes in priority order:

### Phase 1: Core Framework Classes (High Priority)
1. **ContentPipeline** (`modules/cp/core/ContentPipeline.js`)
2. **BVR** (`modules/bvr/core/BVR.js`)
3. **Team** (`modules/bvr/core/Team.js`)

### Phase 2: Shared Libraries (High Priority)
4. **Ulysses** (via ServiceContainer registration)
5. **Airtable** (via ServiceContainer registration)

### Phase 3: Action Updates (Required)
6. Update all action files to use singleton getInstance() methods

## Implementation Requirements

### Pattern to Use

Follow this singleton implementation pattern (thread-safe for JavaScript):

```javascript
class ClassName {
  static #instance = null;
  static #instances = new Map(); // For classes that need instance per key (like Team)

  // Private constructor to prevent direct instantiation
  constructor(/* params */) {
    // Existing constructor code...
  }

  /**
   * Get singleton instance
   * @param {string} key - Optional key for multi-instance singletons
   * @returns {ClassName} Singleton instance
   */
  static getInstance(/* params */) {
    // For simple singletons (ContentPipeline, BVR):
    if (!ClassName.#instance) {
      ClassName.#instance = new ClassName(/* params */);
    }
    return ClassName.#instance;

    // OR for keyed singletons (Team - one instance per teamID):
    const key = params.teamID || 'default';
    if (!ClassName.#instances.has(key)) {
      ClassName.#instances.set(key, new ClassName(params));
    }
    return ClassName.#instances.get(key);
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance() {
    ClassName.#instance = null;
    // or
    ClassName.#instances.clear();
  }
}
```

### Backward Compatibility

**CRITICAL:** Maintain backward compatibility during transition period.

- ✅ Keep constructor public (don't make private yet)
- ✅ Allow both `new ContentPipeline()` and `ContentPipeline.getInstance()`
- ✅ Add deprecation console warnings to constructor
- ✅ All public APIs must remain unchanged

Example deprecation warning:
```javascript
constructor(table = "Content") {
  // Deprecation warning
  if (!ContentPipeline.#constructorWarningShown) {
    console.log('[DEPRECATION] Direct instantiation of ContentPipeline is deprecated. Use ContentPipeline.getInstance() instead.');
    ContentPipeline.#constructorWarningShown = true;
  }

  // Existing constructor code...
}
```

## Detailed Implementation Steps

### Step 1: Implement Singleton for ContentPipeline

**File:** `Library/Scripts/modules/cp/core/ContentPipeline.js`

**Current code (lines 13-46):**
```javascript
class ContentPipeline {
  static basePath = "/Library/Data/cp/";
  static settingsFile = "cp/settings.yaml";
  // ... private fields

  constructor(table = "Content") {
    this.#tableName = table;
    this.#services = ServiceContainer.getInstance();
    this.#activeDoc = null;
    this.#registerServices(table);
    this.#dependencyProvider = new DependencyProvider(/*...*/);
    this.#loadWorkspace();
  }
}
```

**Required changes:**

1. Add static singleton fields at top of class (after line 15):
```javascript
class ContentPipeline {
  static basePath = "/Library/Data/cp/";
  static settingsFile = "cp/settings.yaml";
  static #instances = new Map(); // One instance per table
  static #constructorWarningShown = false;

  // ... rest of class
```

2. Add getInstance() method (before constructor):
```javascript
  /**
   * Get singleton instance of ContentPipeline
   * @param {string} table - Table name (default: "Content")
   * @returns {ContentPipeline} Singleton instance for the table
   */
  static getInstance(table = "Content") {
    if (!ContentPipeline.#instances.has(table)) {
      console.log(`[ContentPipeline] Creating singleton instance for table: ${table}`);
      ContentPipeline.#instances.set(table, new ContentPipeline(table));
    } else {
      console.log(`[ContentPipeline] Reusing singleton instance for table: ${table}`);
    }
    return ContentPipeline.#instances.get(table);
  }

  /**
   * Reset singleton instances (for testing)
   */
  static resetInstance(table = null) {
    if (table) {
      ContentPipeline.#instances.delete(table);
    } else {
      ContentPipeline.#instances.clear();
    }
  }
```

3. Add deprecation warning to constructor (line 30, first line of constructor):
```javascript
  constructor(table = "Content") {
    // Deprecation warning
    if (!ContentPipeline.#constructorWarningShown) {
      console.log('[DEPRECATION] Direct instantiation of ContentPipeline is deprecated. Use ContentPipeline.getInstance() instead.');
      ContentPipeline.#constructorWarningShown = true;
    }

    // Existing constructor code...
    this.#tableName = table;
    // ... rest unchanged
  }
```

**Testing checkpoint:** After this change, verify:
- `const cp = ContentPipeline.getInstance()` works
- `const cp = new ContentPipeline()` still works (with warning)
- Multiple calls to `getInstance()` return same instance
- Different tables get different instances

---

### Step 2: Implement Singleton for BVR

**File:** `Library/Scripts/modules/bvr/core/BVR.js`

**Current code (lines 17-43):**
```javascript
class BVR {
  static settingsFile = "bvr/settings.yaml";
  #settings;
  #ui;
  #services;

  constructor() {
    this.#services = ServiceContainer.getInstance();
    // ... service registration
    this.#loadWorkspace();
  }
}
```

**Required changes:**

1. Add singleton fields:
```javascript
class BVR {
  static settingsFile = "bvr/settings.yaml";
  static #instance = null;
  static #constructorWarningShown = false;

  #settings;
  #ui;
  #services;
```

2. Add getInstance() method:
```javascript
  /**
   * Get singleton instance of BVR
   * @returns {BVR} Singleton instance
   */
  static getInstance() {
    if (!BVR.#instance) {
      console.log('[BVR] Creating singleton instance');
      BVR.#instance = new BVR();
    } else {
      console.log('[BVR] Reusing singleton instance');
    }
    return BVR.#instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance() {
    BVR.#instance = null;
  }
```

3. Add deprecation warning to constructor:
```javascript
  constructor() {
    if (!BVR.#constructorWarningShown) {
      console.log('[DEPRECATION] Direct instantiation of BVR is deprecated. Use BVR.getInstance() instead.');
      BVR.#constructorWarningShown = true;
    }

    // Existing constructor code...
    this.#services = ServiceContainer.getInstance();
    // ... rest unchanged
  }
```

**Testing checkpoint:** Verify same as ContentPipeline.

---

### Step 3: Implement Singleton for Team

**File:** `Library/Scripts/modules/bvr/core/Team.js`

**Current code (lines 3-26):**
```javascript
class Team {
  // ... private fields

  constructor(teamID = "") {
    this.#services = ServiceContainer.getInstance();
    // ... service registration
    this.#teamData = this.#getTeamData(teamID);
  }
}
```

**Required changes:**

1. Add singleton fields:
```javascript
class Team {
  static #instances = new Map(); // One instance per teamID
  static #constructorWarningShown = false;

  #bvr;
  #weekID;
  // ... rest of private fields
```

2. Add getInstance() method:
```javascript
  /**
   * Get singleton instance of Team
   * @param {string} teamID - Team identifier
   * @returns {Team} Singleton instance for the team
   */
  static getInstance(teamID = "") {
    // Use empty string as key for default team
    const key = teamID || '_default';

    if (!Team.#instances.has(key)) {
      console.log(`[Team] Creating singleton instance for team: ${key}`);
      Team.#instances.set(key, new Team(teamID));
    } else {
      console.log(`[Team] Reusing singleton instance for team: ${key}`);
    }
    return Team.#instances.get(key);
  }

  /**
   * Reset singleton instances (for testing)
   * @param {string} teamID - Optional team to reset, or all if omitted
   */
  static resetInstance(teamID = null) {
    if (teamID !== null) {
      const key = teamID || '_default';
      Team.#instances.delete(key);
    } else {
      Team.#instances.clear();
    }
  }
```

3. Add deprecation warning:
```javascript
  constructor(teamID = "") {
    if (!Team.#constructorWarningShown) {
      console.log('[DEPRECATION] Direct instantiation of Team is deprecated. Use Team.getInstance() instead.');
      Team.#constructorWarningShown = true;
    }

    // Existing constructor code...
    this.#services = ServiceContainer.getInstance();
    // ... rest unchanged
  }
```

**Special consideration:** Team uses teamID as a key, so multiple teams can have separate singleton instances. This is correct behavior.

---

### Step 4: Register Ulysses as Singleton in ServiceContainer

**File:** `Library/Scripts/shared/core/ServiceFactories.js`

**Add to `setupContentPipelineServices()` function** (around line 145, before closing brace):

```javascript
  // Ulysses shared instance
  container.register('ulysses', (c) => {
    if (typeof Ulysses == "undefined") require("shared/libraries/ulysses-v2.js");
    return new Ulysses();
  }, true); // singleton = true

  // Airtable shared instance (if API key available)
  container.register('airtable', (c) => {
    if (typeof Airtable == "undefined") require("shared/libraries/airtable-v2.js");
    // Note: Airtable constructor requires API key
    // This should be injected from settings or credentials
    return new Airtable(c.get('cpSettings').airtableApiKey);
  }, true);
```

**File:** `Library/Scripts/modules/cp/core/DependencyProvider.js`

**Add Ulysses getter** (after line 60):

```javascript
  get database() {
    return this.#context.db;
  }

  // Add this:
  get ulysses() {
    if (!this.#context.services) {
      return ServiceContainer.getInstance().get('ulysses');
    }
    return this.#context.services.get('ulysses');
  }
```

**File:** `Library/Scripts/modules/cp/documents/UlyssesDocument.js`

**Modify line 24** (constructor):

```javascript
  constructor(dependencyProvider, settings, record = {}) {
    this.#dependencyProvider = dependencyProvider;
    this.#ui = dependencyProvider.ui;
    this.#text = dependencyProvider.textUltilities;
    this.#settings = settings;

    // Before:
    // this.#ulysses = new Ulysses();

    // After: Use shared instance from DependencyProvider
    this.#ulysses = dependencyProvider.ulysses;

    this.#data.record = record;
    this.#data.docID = this.#getIdOfSheet();
  }
```

**Testing checkpoint:**
- Create multiple UlyssesDoc instances
- Verify they share the same Ulysses instance
- Check console for "Reusing singleton instance" messages

---

### Step 5: Update All Action Files

Update all action files in `Library/Actions/` to use getInstance() methods.

**Files to update:**

#### ContentPipeline Actions
- `Library/Actions/cp/add-draft-to-pipeline.js`
- `Library/Actions/cp/add-sheet-to-pipeline.js`
- `Library/Actions/cp/beyond-the-book.js`
- `Library/Actions/cp/get-url.js`
- `Library/Actions/cp/sync-status-with-ulysses-id.js`
- `Library/Actions/cp/update-status-of-draft.js`
- `Library/Actions/cp/update-status-with-ulysses-id-v2.js`
- `Library/Actions/cp/update-status-with-ulysses-id-v3.js`
- `Library/Actions/cp/welcome.js`

**Example change:**

**Before (`Library/Actions/cp/add-draft-to-pipeline.js`):**
```javascript
// Content Pipeline Open
require("modules/cp/core/ContentPipeline.js");
const cp = new ContentPipeline();
cp.addDocToPipeline("DraftsID", draft.uuid);
```

**After:**
```javascript
// Content Pipeline Open
require("modules/cp/core/ContentPipeline.js");
const cp = ContentPipeline.getInstance();
cp.addDocToPipeline("DraftsID", draft.uuid);
```

#### BVR/Team Actions
- `Library/Actions/bvr/archive-notes.js`
- `Library/Actions/bvr/bvr-action-menu.js`
- `Library/Actions/bvr/create-game-day-tasks.js`
- `Library/Actions/bvr/create-welcome-letter.js`
- `Library/Actions/bvr/insert-player-name.js`
- `Library/Actions/bvr/migrate-current-season.js`
- `Library/Actions/bvr/practice-plan-create.js`
- `Library/Actions/bvr/practice-plan-load.js`
- `Library/Actions/bvr/record-attendance.js`
- `Library/Actions/bvr/record-score.js`
- `Library/Actions/bvr/start-new-season.js`
- `Library/Actions/bvr/submit-game-report.js`
- `Library/Actions/bvr/update-roster.js`

**Example change (`Library/Actions/bvr/record-attendance.js`):**

**Before:**
```javascript
const oneSecond = 10000;
const recentlyCreated = new Date() - draft.createdAt < oneSecond;
const teamID = recentlyCreated ? draft.content : "";

if (typeof BVR == "undefined") require("modules/bvr/core/BVR.js");

const team = new Team(teamID);

const submitAttendace = team.takeAttendace();
if (submitAttendace) team.submitAttendace();

delete team;
```

**After:**
```javascript
const oneSecond = 10000;
const recentlyCreated = new Date() - draft.createdAt < oneSecond;
const teamID = recentlyCreated ? draft.content : "";

if (typeof Team == "undefined") require("modules/bvr/core/Team.js");

const team = Team.getInstance(teamID);

const submitAttendace = team.takeAttendace();
if (submitAttendace) team.submitAttendace();

// Note: Don't delete singleton - it persists intentionally
```

**Pattern for all action files:**
1. Replace `new ContentPipeline()` → `ContentPipeline.getInstance()`
2. Replace `new BVR()` → `BVR.getInstance()`
3. Replace `new Team(id)` → `Team.getInstance(id)`
4. Remove any `delete` statements for singleton objects

---

### Step 6: Update Internal Instantiations

Search for and update any internal code that creates these classes:

**Search patterns:**
```bash
grep -r "new ContentPipeline()" Library/Scripts/
grep -r "new BVR()" Library/Scripts/
grep -r "new Team(" Library/Scripts/
```

**Files likely to have internal instantiations:**
- `Library/Scripts/modules/bvr/core/Season.js` (lines 23-24, 31-32)
- `Library/Scripts/modules/bvr/core/Team.js` (line 20 - BVR service registration)
- Test files in `Library/Scripts/cp/tests/`
- Test files in `Library/Scripts/bvr/tests/`

**Update pattern:**
- If it's a service registration → Keep as-is (factory function is correct)
- If it's direct usage → Change to getInstance()

---

## Testing & Validation

### Unit Tests

Create test file: `Library/Tests/singleton-validation-test.js`

```javascript
/**
 * Singleton Pattern Validation Test
 * Verifies that singleton implementations work correctly
 */

// Test ContentPipeline
require("modules/cp/core/ContentPipeline.js");

console.log('=== Testing ContentPipeline Singleton ===');

const cp1 = ContentPipeline.getInstance();
const cp2 = ContentPipeline.getInstance();
const cp3 = ContentPipeline.getInstance("Content");
const cp4 = ContentPipeline.getInstance("Archive");

console.log('cp1 === cp2:', cp1 === cp2 ? 'PASS ✅' : 'FAIL ❌');
console.log('cp1 === cp3:', cp1 === cp3 ? 'PASS ✅' : 'FAIL ❌');
console.log('cp1 === cp4:', cp1 === cp4 ? 'FAIL ❌ (different table)' : 'PASS ✅');

// Test BVR
require("modules/bvr/core/BVR.js");

console.log('\n=== Testing BVR Singleton ===');

const bvr1 = BVR.getInstance();
const bvr2 = BVR.getInstance();

console.log('bvr1 === bvr2:', bvr1 === bvr2 ? 'PASS ✅' : 'FAIL ❌');

// Test Team
require("modules/bvr/core/Team.js");

console.log('\n=== Testing Team Singleton ===');

const team1 = Team.getInstance("varsity");
const team2 = Team.getInstance("varsity");
const team3 = Team.getInstance("jv");

console.log('team1 === team2:', team1 === team2 ? 'PASS ✅' : 'FAIL ❌');
console.log('team1 === team3:', team1 === team3 ? 'FAIL ❌ (different team)' : 'PASS ✅');

// Test backward compatibility
console.log('\n=== Testing Backward Compatibility ===');

const cpOldStyle = new ContentPipeline();
console.log('new ContentPipeline() works:', cpOldStyle ? 'PASS ✅' : 'FAIL ❌');
console.log('Check console for deprecation warning');

console.log('\n=== All Singleton Tests Complete ===');
```

### Integration Tests

Run these existing actions and verify they work:
1. `add-draft-to-pipeline` - Should work identically
2. `record-attendance` - Should work identically
3. `welcome` - Should work identically

Check console logs for:
- "Creating singleton instance" (first run)
- "Reusing singleton instance" (subsequent runs)
- Deprecation warnings (if any old-style instantiation remains)

### Memory Test

Run the singleton memory test again after implementation:

```javascript
require("Tests/singleton-memory-test-simple.js");
```

Expected results:
- Instance counts should be much lower
- Same singleton reused across multiple calls
- Console shows "Reusing singleton instance" messages

---

## Acceptance Criteria

Before considering this task complete, verify:

- ✅ All 3 core classes (ContentPipeline, BVR, Team) have getInstance() methods
- ✅ All action files updated to use getInstance()
- ✅ Ulysses registered in ServiceContainer as singleton
- ✅ UlyssesDocument uses shared Ulysses instance
- ✅ Backward compatibility maintained (direct instantiation still works)
- ✅ Deprecation warnings appear for old-style usage
- ✅ Unit tests pass (singleton-validation-test.js)
- ✅ Integration tests pass (existing actions work)
- ✅ Memory test shows instance reuse
- ✅ No breaking changes to public APIs
- ✅ Console logs show "Reusing singleton instance" on repeated calls

---

## Notes & Considerations

### Why Map for ContentPipeline and Team?

- **ContentPipeline**: Different tables ("Content" vs "Archive") should have separate instances
- **Team**: Different teams (varsity, jv, etc.) should have separate instances
- **BVR**: Only one BVR instance needed globally (simple singleton)

### Constructor Still Public

We're keeping constructors public during the transition period to maintain backward compatibility. In a future phase, we could:
1. Make constructors private (rename to `#constructor`)
2. Remove deprecation warnings
3. Break old code that uses `new ClassName()`

But for now, we want zero breaking changes.

### Delete Statements

Remove `delete team;` and similar statements from actions. Singletons are intentionally persistent and shouldn't be deleted.

### ServiceContainer Integration

The existing ServiceContainer is already a singleton. We're adding our classes as singletons within that container. This is the correct pattern - singleton container holding singleton services.

---

## Expected Outcomes

After implementation:

1. **Memory usage**: 60-70% reduction in object instantiation overhead
2. **Performance**: Faster action execution (no repeated initialization)
3. **Code quality**: Clearer pattern for object lifecycle management
4. **Testing**: Easier to test with resetInstance() methods
5. **Maintainability**: Single source of truth for each major component

---

## Questions or Issues?

If you encounter any issues during implementation:

1. **Circular dependencies**: If you see errors about classes not defined, check the require() order
2. **ServiceContainer errors**: Make sure ServiceContainer is loaded before classes that use it
3. **DependencyProvider issues**: The #context might not have services property - add null checks
4. **Testing failures**: Use resetInstance() methods to clear state between tests

Document any issues in comments and continue with other parts if blocked.

---

## Summary

This is a high-impact, low-risk refactoring:
- High impact: 60-70% memory savings
- Low risk: Backward compatible, incremental rollout possible
- Clear testing: Multiple test files to validate

Follow the steps in order, test after each phase, and ensure all acceptance criteria are met.
