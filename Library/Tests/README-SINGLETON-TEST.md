# Singleton Memory Persistence Tests

Tests to verify whether singleton patterns would benefit the Drafts scripts codebase.

## The Question

**Does JavaScript memory persist between Drafts action executions?**

If YES → Singleton pattern provides significant benefits (objects reused across runs)
If NO → Singleton pattern only helps within a single run (still useful but less dramatic)

## Test Files

### 1. `singleton-memory-test-simple.js` ⭐ **RECOMMENDED**

**Fastest, easiest test. Start here.**

- Minimal code (~100 lines)
- Clear alerts with interpretation
- Writes results to draft
- Takes 30 seconds to run

### 2. `singleton-memory-test.js`

**Comprehensive test with detailed logging.**

- Full mock class implementation
- Tests both patterns side-by-side
- ServiceContainer pattern demonstration
- Console-heavy output (requires viewing logs)

## How to Run the Simple Test

### Setup (One-time, 2 minutes)

1. **Open Drafts app**

2. **Create a new Action:**
   - Tap the ⚙️ icon (Actions)
   - Tap `+` to create new action
   - Name it: "Test Singleton Memory"

3. **Add Script step:**
   - Tap "Add Step" → "Script"
   - In the script editor, add a require statement:
     ```javascript
     require("Tests/singleton-memory-test-simple.js");
     ```
   - Save the step

4. **Save the Action**

### Testing (5 minutes)

1. **Create a new blank draft** (or use any draft)

2. **Run the action:**
   - Swipe right on the draft
   - Tap "Test Singleton Memory"
   - **Read the alert** - it shows Run #1

3. **Run it again immediately:**
   - Swipe right again
   - Tap "Test Singleton Memory" again
   - **Check the alert** - does it say Run #2 or Run #1?

4. **Run it 5-10 more times:**
   - Keep running the same action
   - Watch the Run # counter

5. **Check your draft:**
   - The test appends results to your draft
   - Review the log entries at the top

### Interpreting Results

#### Scenario A: Run # Increases Each Time

```
Run #1 → Run #2 → Run #3 → Run #4 ...
```

**Meaning:** Memory is **cleared** between action runs.

**Impact on Singleton Pattern:**
- ⚠️ Cross-run persistence: **NO BENEFIT**
- ✅ Within-run optimization: **Still helpful**
- 📊 Expected savings: 30-40% (not 60-70%)

**Recommendation:** Still implement singletons for:
- Actions that call multiple methods on same instance
- Reducing initialization overhead within single run
- Code clarity and testing benefits

---

#### Scenario B: Run # Stays the Same

```
Run #1 → Run #1 → Run #1 → Run #1 ...
```

**Meaning:** Memory **persists** between action runs!

**Impact on Singleton Pattern:**
- ✅ Cross-run persistence: **HUGE BENEFIT**
- ✅ Within-run optimization: **Also helpful**
- 📊 Expected savings: 60-70% as estimated

**Recommendation:** **Definitely** implement singletons:
- ContentPipeline should be singleton
- BVR should be singleton
- Team should be singleton
- All shared libraries (Ulysses, Airtable, etc.)

---

#### Scenario C: Mixed Behavior

```
Sometimes increases, sometimes stays same
```

**Meaning:** Persistence depends on context (app state, memory pressure, etc.)

**Impact:** Variable benefits, but singletons still help in best case.

**Recommendation:** Implement singletons, treat persistence as bonus optimization.

## Advanced: Full Test

If you want detailed console logging:

1. **Open Console:**
   - In Drafts, go to Settings → Editor → Enable "Show Console"

2. **Use the comprehensive test:**
   ```javascript
   require("Tests/singleton-memory-test.js");
   ```

3. **Check console output** after each run

## What to Report

After running the tests, report back with:

1. **Run # behavior:** Does it increase or stay the same?
2. **Your Drafts version:** (Settings → About)
3. **Platform:** iOS or macOS
4. **Draft content shown:** The log entries in your draft

This will help determine the best optimization strategy!

## Example Expected Output

### In Alert (Simple Test)
```
Singleton Memory Test Results:

Run #3
Total Instances: 9

✅ Memory PERSISTS between runs!

Singleton pattern will be VERY effective.

ContentPipeline, BVR, Team should
definitely use singletons.

Run this again to confirm.
```

### In Draft (Simple Test)
```markdown
## Singleton Test Run #3

**Time:** 2025-10-02T14:32:15.123Z

**Results:**
- Global counter: 3
- Static counter: 9
- Memory persists: YES ✅
- Static persists: YES ✅

**Conclusion:**
Memory DOES persist. Singleton pattern recommended
for ContentPipeline, BVR, Team.

---
```

## Troubleshooting

**Problem:** Action doesn't run / error message

**Solution:** Check that the require path matches your file location:
- If file is at `Library/Scripts/Tests/singleton-memory-test-simple.js`
- Use: `require("Tests/singleton-memory-test-simple.js")`
- Or try absolute path from Scripts folder

---

**Problem:** Alert shows "Run #1" every time

**Solution:** This means memory is NOT persisting. This is valid test result!

---

**Problem:** Want to reset the counter

**Solution:** Close Drafts app completely and reopen it. The counter should reset.

## Next Steps

After determining if memory persists:

1. **Share results** with the analysis
2. **Adjust implementation priorities** based on findings
3. **Proceed with refactoring** using appropriate patterns

## Questions?

Check these sections in the main analysis report:
- Section 2: Memory Efficiency
- Section 4: Dependency Management
- Implementation Roadmap
