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
