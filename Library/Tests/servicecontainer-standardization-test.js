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
  console.log('✅ initializeServices(): PASS');
} catch (e) {
  console.log('❌ initializeServices(): FAIL', e.message);
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
  console.log(`${service}:`, exists ? '✅ PASS' : '❌ FAIL');
});

// Test 3: Get ContentPipeline via container
console.log('\n--- Test 3: Get ContentPipeline ---');
try {
  const cp = container.get('cpDefault');
  console.log('✅ get cpDefault: PASS');
  console.log('cpDefault is ContentPipeline:',
    cp.constructor.name === 'ContentPipeline' ? '✅ PASS' : '❌ FAIL');
} catch (e) {
  console.log('❌ get cpDefault: FAIL', e.message);
}

// Test 4: Get Team via factory
console.log('\n--- Test 4: Get Team via Factory ---');
try {
  const teamFactory = container.get('teamFactory');
  const team = teamFactory('test-team');
  console.log('✅ get teamFactory: PASS');
  console.log('✅ create team instance: PASS');
  console.log('team is Team:',
    team.constructor.name === 'Team' ? '✅ PASS' : '❌ FAIL');
} catch (e) {
  console.log('❌ get teamFactory: FAIL', e.message);
}

// Test 5: Get BVR singleton
console.log('\n--- Test 5: Get BVR Singleton ---');
try {
  const bvr1 = container.get('bvr');
  const bvr2 = container.get('bvr');
  console.log('✅ get bvr: PASS');
  console.log('bvr is singleton:',
    bvr1 === bvr2 ? '✅ PASS' : '❌ FAIL');
} catch (e) {
  console.log('❌ get bvr: FAIL', e.message);
}

// Test 6: Get Ulysses singleton
console.log('\n--- Test 6: Get Ulysses Singleton ---');
try {
  const ulysses1 = container.get('ulysses');
  const ulysses2 = container.get('ulysses');
  console.log('✅ get ulysses: PASS');
  console.log('ulysses is singleton:',
    ulysses1 === ulysses2 ? '✅ PASS' : '❌ FAIL');
} catch (e) {
  console.log('❌ get ulysses: FAIL', e.message);
}

// Test 7: Idempotent initialization
console.log('\n--- Test 7: Idempotent Initialization ---');
try {
  initializeServices(); // Call again
  initializeServices(); // And again
  console.log('✅ Multiple init calls: PASS (no errors thrown)');
} catch (e) {
  console.log('❌ Multiple init calls: FAIL', e.message);
}

// Test 8: Service count
console.log('\n--- Test 8: Service Count ---');
const registeredServices = container.getRegisteredServices();
console.log(`Total services registered: ${registeredServices.length}`);
console.log('Expected minimum: 13');
console.log('Service count check:',
  registeredServices.length >= 13 ? '✅ PASS' : '❌ FAIL');

console.log('\n=== ServiceContainer Standardization Tests Complete ===');
console.log('\nAll tests should show ✅ PASS');
console.log('If any tests show ❌ FAIL, review the service registration in ServiceInitializer.js');
