# Running Tests in Drafts

## Option 1: Create a Drafts Action

1. Open Drafts app
2. Create a new Action
3. Add a "Script" step
4. Paste the following code:

```javascript
// Run Action System Tests
require("cp/testing/run_tests.js");
```

5. Name the action "Run Action System Tests"
6. Save and run the action

## Option 2: Run from Script Editor

1. Open Drafts app
2. Go to Settings > Script Editor (or create a new draft)
3. Paste the following code:

```javascript
require("cp/testing/run_tests.js");
```

4. Run the script

## Option 3: Quick Test Action (Copy this JSON)

Copy the JSON below and import it as a Drafts action:

```json
{
  "uuid": "ACTION-TESTS-UUID-1234",
  "name": "Run Action System Tests",
  "description": "Run comprehensive tests for the Action System",
  "icon": "checkmark.circle",
  "color": "green",
  "steps": [
    {
      "type": "script",
      "script": "require(\"cp/testing/run_tests.js\");"
    }
  ]
}
```

## What the Tests Cover

### TriggerEvaluator Tests (20 tests)
- Equals operator with matching/non-matching values
- Case-insensitive comparisons
- Not equals operator
- Regex matching with matches operator
- Contains operator for substring matching
- Older than operator for date comparisons
- Default operator behavior
- Context field evaluation
- Field prioritization
- No condition handling
- Unknown operator handling
- Undefined field handling

### ActionRegistry Tests (10 tests)
- Handler registration and retrieval
- Validation of execute method
- Error handling for invalid handlers
- Multiple handler registration
- Handler overwriting
- Async and sync handler support

### ActionHistory Tests (12 tests)
- History initialization
- Recording action executions
- Querying by docID, destination, trigger type, action type, result
- Query result limiting
- Multiple filter combinations
- Clearing history
- Timestamp inclusion
- Error detail recording

### ActionSystem Tests (12 tests)
- Trigger evaluation and action execution
- Condition matching
- Template variable interpolation
- Multiple action sequences
- Action failure handling
- Unknown destination handling
- Custom action registration
- Context passing
- Missing config handling

### ActionHandler Tests (15+ tests)
- LogAction: message logging with levels
- NotificationAction: UI notifications
- ConvertDocumentAction: document type conversion
- ArchiveDocumentAction: document archival
- Parameter validation
- Error handling
- Property copying

## Expected Output

When tests run successfully, you'll see:

```
╔════════════════════════════════════════════════════════════╗
║        Action System Test Suite for Drafts                ║
╚════════════════════════════════════════════════════════════╝

=============================================================
Running Tests
=============================================================
  ✓ TriggerEvaluator > should evaluate equals operator...
  ✓ TriggerEvaluator > should evaluate not_equals...
  ... (all passing tests listed)

=============================================================
Test Results
=============================================================

TriggerEvaluator: 20/20 passed (0 failed)
ActionRegistry: 10/10 passed (0 failed)
ActionHistory: 12/12 passed (0 failed)
ActionSystem: 12/12 passed (0 failed)
ActionHandlers: 15/15 passed (0 failed)

-------------------------------------------------------------
Total: 69/69 passed (0 failed)
=============================================================

╔════════════════════════════════════════════════════════════╗
║                       Summary                              ║
╚════════════════════════════════════════════════════════════╝
  Total Tests:    69
  Passed:         69
  Failed:         0
  Pass Rate:      100.0%

  ✅ All tests passed!
```

## Troubleshooting

### Tests Won't Run
- Ensure all test files are in `Library/Scripts/cp/testing/`
- Check that the action system files are properly installed
- Verify file paths in require() statements match your setup

### Some Tests Fail
- Check the error messages in the output
- Review the specific test that failed
- Verify the action system implementation matches test expectations

### Console Not Showing Output
- In Drafts, make sure console logging is enabled
- Check Settings > Editor > Show Console
- Look for test output in the console panel

## Running Individual Test Suites

To run only specific test suites, create a custom runner:

```javascript
require("cp/testing/TestFramework.js");
require("cp/testing/TriggerEvaluator.test.js");

const framework = new TestFramework();
runTriggerEvaluatorTests(framework);
await framework.run();
```

## Continuous Testing

Consider adding tests to your workflow:
1. Run tests after making changes to action system
2. Run tests before deploying to production
3. Add test running to your CI/CD pipeline (if applicable)