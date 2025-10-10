/**
 * INLINE SINGLETON TEST
 *
 * Copy this entire file into a Drafts action script step.
 * Run the action 5-10 times and watch the counter.
 *
 * NO SETUP REQUIRED - Just paste and run!
 */

// Initialize global counter (persists if memory persists)
if (!globalThis._testRun) globalThis._testRun = 0;
globalThis._testRun++;

// Display result
alert(
  `Memory Persistence Test\n\n` +
  `Run #${globalThis._testRun}\n\n` +
  (globalThis._testRun === 1
    ? `First run. Run again to test!`
    : `Memory ${globalThis._testRun > 1 ? 'PERSISTS ✅' : 'does not persist ❌'}\n\n` +
      `Singleton pattern will be ${globalThis._testRun > 1 ? 'VERY' : 'somewhat'} beneficial.`
  )
);

console.log(`Test run #${globalThis._testRun} complete`);
