// run_tests.js
// Test runner for action system tests in Drafts

require("cp/testing/TestFramework.js");
require("cp/testing/TriggerEvaluator.test.js");
require("cp/testing/ActionRegistry.test.js");
require("cp/testing/ActionHistory.test.js");
require("cp/testing/ActionSystem.test.js");
require("cp/testing/ActionHandlers.test.js");

async function runAllTests() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        Action System Test Suite for Drafts                ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("\n");

  const framework = new TestFramework();

  // Register all test suites
  runTriggerEvaluatorTests(framework);
  runActionRegistryTests(framework);
  runActionHistoryTests(framework);
  runActionSystemTests(framework);
  runActionHandlerTests(framework);

  // Run all tests
  const results = await framework.run();

  // Display summary
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                       Summary                              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const total = results.passed + results.failed;
  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;

  console.log(`  Total Tests:    ${total}`);
  console.log(`  Passed:         ${results.passed}`);
  console.log(`  Failed:         ${results.failed}`);
  console.log(`  Pass Rate:      ${passRate}%`);
  console.log("\n");

  if (results.failed === 0) {
    console.log("  ✅ All tests passed!");
  } else {
    console.log(`  ❌ ${results.failed} test(s) failed. See details above.`);
  }

  console.log("\n");

  return results;
}

// Run tests
runAllTests();