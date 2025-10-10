/**
 * SIMPLE Singleton Memory Test
 *
 * A minimal test to check if objects persist between Drafts action runs.
 *
 * SETUP:
 * 1. Create a new Drafts action called "Test Singleton Memory"
 * 2. Set action step to "Script" and paste this file's contents
 * 3. Save the action
 *
 * TESTING:
 * 1. Run the action once - note the "Run #" in the alert
 * 2. Run it again immediately (without closing Drafts)
 * 3. Run it 5-10 more times
 * 4. Check if "Run #" increases or stays the same
 *
 * RESULTS:
 * - If Run # increases each time → Memory cleared between runs (Singleton less useful)
 * - If Run # stays at 1 → Memory persists (Singleton very useful!)
 */

// Global counter to track if memory persists
if (typeof globalThis._singletonTestCounter === 'undefined') {
  globalThis._singletonTestCounter = 0;
  console.log('✨ First run: Creating global counter');
} else {
  console.log(`♻️  Reusing existing counter (value: ${globalThis._singletonTestCounter})`);
}

globalThis._singletonTestCounter++;

// Test class with instance counter
class TestClass {
  static totalCreated = 0;

  constructor() {
    TestClass.totalCreated++;
    this.id = TestClass.totalCreated;
    this.timestamp = new Date().toISOString();
    console.log(`[TestClass] Created instance #${this.id}`);
  }
}

// Create some instances
console.log('\n--- Creating instances ---');
const instance1 = new TestClass();
const instance2 = new TestClass();
const instance3 = new TestClass();

// Report results
console.log('\n--- RESULTS ---');
console.log(`Global run counter: ${globalThis._singletonTestCounter}`);
console.log(`Instances created this run: 3`);
console.log(`Total instances counter: ${TestClass.totalCreated}`);
console.log(`Instance IDs: ${instance1.id}, ${instance2.id}, ${instance3.id}`);

// Interpretation
const memoryPersists = globalThis._singletonTestCounter > 1;
const staticPersists = TestClass.totalCreated > 3;

console.log('\n--- INTERPRETATION ---');
console.log(`Memory persists (global): ${memoryPersists ? 'YES ✅' : 'NO (first run)'}`);
console.log(`Static persists (class): ${staticPersists ? 'YES ✅' : 'NO (first run)'}`);

// Alert with key findings
const message = `
Singleton Memory Test Results:

Run #${globalThis._singletonTestCounter}
Total Instances: ${TestClass.totalCreated}

${globalThis._singletonTestCounter === 1 ?
  '⚠️ First run - run again to test!' :
  memoryPersists ?
    '✅ Memory PERSISTS between runs!\n\nSingleton pattern will be VERY effective.\n\nContentPipeline, BVR, Team should definitely use singletons.' :
    '❌ Memory CLEARED between runs.\n\nSingleton pattern only helps within single run (still useful but less impactful).'
}

Run this ${globalThis._singletonTestCounter < 5 ? 'again' : 'a few more times'} to confirm.
`.trim();

alert(message);

// Save results to draft for review
if (draft) {
  const resultLog = `
## Singleton Test Run #${globalThis._singletonTestCounter}

**Time:** ${new Date().toISOString()}

**Results:**
- Global counter: ${globalThis._singletonTestCounter}
- Static counter: ${TestClass.totalCreated}
- Memory persists: ${memoryPersists ? 'YES ✅' : 'First run'}
- Static persists: ${staticPersists ? 'YES ✅' : 'First run'}

**Conclusion:**
${globalThis._singletonTestCounter === 1 ?
  'First run - need more data' :
  memoryPersists ?
    'Memory DOES persist. Singleton pattern recommended for ContentPipeline, BVR, Team.' :
    'Memory does NOT persist across runs. Singleton still useful within single run.'
}

---
`;

  draft.prepend(resultLog);
  draft.update();
}

console.log('\n✅ Test complete. Check alert and draft for results.');
