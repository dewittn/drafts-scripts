/**
 * Singleton Memory Persistence Test
 *
 * Tests whether singleton instances persist in memory across
 * multiple Drafts action executions.
 *
 * HOW TO RUN:
 * 1. Create a new Drafts action
 * 2. Set it to run this script
 * 3. Run the action multiple times (5-10 times)
 * 4. Check the console/log output each time
 *
 * WHAT TO LOOK FOR:
 * - If "Instance Count" increases each run → Memory DOES NOT persist (Singleton won't help)
 * - If "Instance Count" stays at 1 → Memory DOES persist (Singleton will help significantly)
 */

// ============================================
// Mock Class - Simulates ContentPipeline
// ============================================
class HeavyMockClass {
  static instanceCount = 0;
  static #singletonInstance = null;

  #id;
  #data;
  #createdAt;

  constructor() {
    HeavyMockClass.instanceCount++;
    this.#id = HeavyMockClass.instanceCount;
    this.#createdAt = new Date();

    // Simulate heavy initialization
    this.#data = this.#simulateHeavyWork();

    console.log(`[Constructor] Creating instance #${this.#id} at ${this.#createdAt.toISOString()}`);
  }

  // Singleton implementation
  static getInstance() {
    if (!HeavyMockClass.#singletonInstance) {
      console.log('[Singleton] Creating new singleton instance');
      HeavyMockClass.#singletonInstance = new HeavyMockClass();
    } else {
      console.log('[Singleton] Reusing existing singleton instance');
    }
    return HeavyMockClass.#singletonInstance;
  }

  // Simulate heavy initialization work
  #simulateHeavyWork() {
    const data = [];
    for (let i = 0; i < 1000; i++) {
      data.push({ id: i, value: `Item ${i}`, timestamp: Date.now() });
    }
    return data;
  }

  getInfo() {
    return {
      id: this.#id,
      createdAt: this.#createdAt,
      dataLength: this.#data.length,
      totalInstances: HeavyMockClass.instanceCount
    };
  }
}

// ============================================
// Test Runner
// ============================================
function runSingletonTest() {
  console.log('\n========================================');
  console.log('SINGLETON MEMORY PERSISTENCE TEST');
  console.log('========================================\n');

  // Display current state
  console.log('--- Current Static State ---');
  console.log(`Total instances created (static): ${HeavyMockClass.instanceCount}`);
  console.log('');

  // Test 1: Direct instantiation (current pattern)
  console.log('--- Test 1: Direct Instantiation (Current Pattern) ---');
  const directInstance1 = new HeavyMockClass();
  const directInstance2 = new HeavyMockClass();

  console.log('Instance 1 info:', JSON.stringify(directInstance1.getInfo(), null, 2));
  console.log('Instance 2 info:', JSON.stringify(directInstance2.getInfo(), null, 2));
  console.log('Are they the same instance?', directInstance1 === directInstance2 ? 'YES' : 'NO');
  console.log('');

  // Test 2: Singleton pattern
  console.log('--- Test 2: Singleton Pattern (Proposed Pattern) ---');
  const singletonInstance1 = HeavyMockClass.getInstance();
  const singletonInstance2 = HeavyMockClass.getInstance();

  console.log('Instance 1 info:', JSON.stringify(singletonInstance1.getInfo(), null, 2));
  console.log('Instance 2 info:', JSON.stringify(singletonInstance2.getInfo(), null, 2));
  console.log('Are they the same instance?', singletonInstance1 === singletonInstance2 ? 'YES' : 'NO');
  console.log('');

  // Summary
  console.log('--- Summary ---');
  console.log(`Total instances created this run: ${HeavyMockClass.instanceCount}`);
  console.log(`Memory savings with Singleton: ${((2 / HeavyMockClass.instanceCount) * 100).toFixed(1)}% fewer instances`);
  console.log('');

  // Instructions for interpretation
  console.log('--- Interpretation Guide ---');
  console.log('🔍 Run this action 5-10 times and observe the "Total instances created (static)" at the top.');
  console.log('');
  console.log('IF the count INCREASES with each run:');
  console.log('  ✅ Memory does NOT persist between runs');
  console.log('  ⚠️  Singleton pattern provides NO cross-run benefits');
  console.log('  ✅ BUT still helps within a single run (see "Memory savings" above)');
  console.log('');
  console.log('IF the count STAYS THE SAME after first run:');
  console.log('  ✅ Memory DOES persist between runs');
  console.log('  ✅ Singleton pattern provides SIGNIFICANT benefits');
  console.log('  ✅ Recommended to implement for ContentPipeline, BVR, Team');
  console.log('');

  // User-friendly alert
  alert(`Test Complete!\n\nRun Count: ${HeavyMockClass.instanceCount}\n\nCheck console for details.\n\nRun this action 5-10 times to see if the count increases.`);
}

// ============================================
// Additional Test: ServiceContainer Pattern
// ============================================
function testServiceContainer() {
  console.log('\n========================================');
  console.log('SERVICE CONTAINER PATTERN TEST');
  console.log('========================================\n');

  // Simple ServiceContainer implementation
  class SimpleServiceContainer {
    static #instance = null;
    #services = new Map();
    #instanceCounts = new Map();

    static getInstance() {
      if (!SimpleServiceContainer.#instance) {
        console.log('[ServiceContainer] Creating new container instance');
        SimpleServiceContainer.#instance = new SimpleServiceContainer();
      } else {
        console.log('[ServiceContainer] Reusing existing container');
      }
      return SimpleServiceContainer.#instance;
    }

    register(name, factory, singleton = true) {
      this.#services.set(name, { factory, singleton, instance: null });
      this.#instanceCounts.set(name, 0);
    }

    get(name) {
      const service = this.#services.get(name);
      if (!service) {
        throw new Error(`Service '${name}' not registered`);
      }

      if (service.singleton && service.instance) {
        console.log(`[Container] Returning cached instance of '${name}'`);
        return service.instance;
      }

      console.log(`[Container] Creating new instance of '${name}'`);
      const count = this.#instanceCounts.get(name) + 1;
      this.#instanceCounts.set(name, count);

      const instance = service.factory();
      if (service.singleton) {
        service.instance = instance;
      }

      return instance;
    }

    getStats() {
      const stats = {};
      for (const [name, count] of this.#instanceCounts.entries()) {
        stats[name] = count;
      }
      return stats;
    }
  }

  // Test the container
  const container = SimpleServiceContainer.getInstance();

  // Register a mock service
  container.register('mockService', () => {
    return new HeavyMockClass();
  }, true);

  // Get the service multiple times
  console.log('--- Getting service 3 times ---');
  const service1 = container.get('mockService');
  const service2 = container.get('mockService');
  const service3 = container.get('mockService');

  console.log('');
  console.log('--- Results ---');
  console.log('All same instance?', service1 === service2 && service2 === service3 ? 'YES ✅' : 'NO ❌');
  console.log('Container stats:', JSON.stringify(container.getStats(), null, 2));
  console.log('');
}

// ============================================
// Run Tests
// ============================================
console.log('Starting Singleton Memory Persistence Test...\n');

// Track execution
const runNumber = (typeof globalThis.testRunNumber === 'undefined') ? 1 : globalThis.testRunNumber + 1;
globalThis.testRunNumber = runNumber;

console.log(`========================================`);
console.log(`THIS IS EXECUTION #${runNumber}`);
console.log(`========================================\n`);

// Run main test
runSingletonTest();

// Run service container test
testServiceContainer();

// Final summary
console.log('\n========================================');
console.log('TEST COMPLETE');
console.log('========================================');
console.log(`This was execution #${runNumber}`);
console.log('Run this script several more times to observe behavior.');
console.log('========================================\n');
