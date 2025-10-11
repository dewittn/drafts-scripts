/**
 * ServiceContainer Comprehensive Unit Tests
 *
 * Tests ServiceContainer in isolation covering:
 * - Singleton pattern
 * - Service registration (singleton vs factory)
 * - Lazy instantiation
 * - Dependency resolution
 * - Error handling
 * - Reset functionality
 */

// Load test infrastructure
require("../Tests/fixtures/assertions.js");

// Load ServiceContainer
require("shared/core/ServiceContainer.js");

// Create test instance
const test = new TestAssertions('ServiceContainer Comprehensive Tests');

// =============================================================================
// Test Classes for Mock Services
// =============================================================================

class TestService {
  constructor(name = 'default') {
    this.name = name;
    this.initialized = true;
  }

  getValue() {
    return `Service: ${this.name}`;
  }
}

class DependentService {
  constructor(dependency) {
    this.dependency = dependency;
  }

  getDependencyValue() {
    return this.dependency.getValue();
  }
}

// =============================================================================
// Section 1: Singleton Instance Behavior
// =============================================================================

test.section('Singleton Instance Behavior');

const container1 = ServiceContainer.getInstance();
const container2 = ServiceContainer.getInstance();

test.assert(container1 === container2, 'getInstance() returns same instance');
test.assertType(container1, 'ServiceContainer', 'Returns ServiceContainer instance');

const container3 = new ServiceContainer();
test.assert(container1 === container3, 'new ServiceContainer() returns singleton instance');

// =============================================================================
// Section 2: Service Registration - Singleton
// =============================================================================

test.section('Service Registration - Singleton');

// Reset to ensure clean state
container1.reset();

// Track initialization calls
let initCount = 0;
container1.register('testService', () => {
  initCount++;
  return new TestService('singleton');
}, true);

test.assertEqual(initCount, 0, 'Service not initialized on registration');
test.assert(container1.has('testService'), 'Service is registered');

const service1 = container1.get('testService');
test.assertEqual(initCount, 1, 'Service initialized on first get()');
test.assertType(service1, 'TestService', 'Returns correct service type');
test.assertEqual(service1.name, 'singleton', 'Service has correct configuration');

const service2 = container1.get('testService');
test.assertEqual(initCount, 1, 'Service not re-initialized on second get()');
test.assert(service1 === service2, 'Singleton returns same instance');

// =============================================================================
// Section 3: Service Registration - Factory
// =============================================================================

test.section('Service Registration - Factory');

container1.reset();

let factoryInitCount = 0;
container1.register('factoryService', () => {
  factoryInitCount++;
  return new TestService(`factory-${factoryInitCount}`);
}, false);

test.assertEqual(factoryInitCount, 0, 'Factory not called on registration');

const instance1 = container1.get('factoryService');
test.assertEqual(factoryInitCount, 1, 'Factory called on first get()');
test.assertEqual(instance1.name, 'factory-1', 'First instance has correct name');

const instance2 = container1.get('factoryService');
test.assertEqual(factoryInitCount, 2, 'Factory called on second get()');
test.assertEqual(instance2.name, 'factory-2', 'Second instance has correct name');

test.assert(instance1 !== instance2, 'Factory returns different instances');

// =============================================================================
// Section 4: Re-registration Behavior
// =============================================================================

test.section('Re-registration Behavior');

container1.reset();

container1.register('reregService', () => new TestService('v1'), true);
const v1 = container1.get('reregService');
test.assertEqual(v1.name, 'v1', 'First registration loaded');

// Re-register with new factory
container1.register('reregService', () => new TestService('v2'), true);
const v2 = container1.get('reregService');
test.assertEqual(v2.name, 'v2', 'Re-registration creates new instance');
test.assert(v1 !== v2, 'Re-registration clears cached singleton');

// =============================================================================
// Section 5: Instance Registration
// =============================================================================

test.section('Instance Registration');

container1.reset();

const existingInstance = new TestService('existing');
container1.registerInstance('existingService', existingInstance);

test.assert(container1.has('existingService'), 'Instance is registered');

const retrieved = container1.get('existingService');
test.assert(retrieved === existingInstance, 'Retrieved instance is the same object');

const retrieved2 = container1.get('existingService');
test.assert(retrieved2 === existingInstance, 'Instance registration acts as singleton');

// =============================================================================
// Section 6: Dependency Resolution
// =============================================================================

test.section('Dependency Resolution');

container1.reset();

// Register base service
container1.register('baseService', () => new TestService('base'), true);

// Register dependent service that uses container to resolve dependencies
container1.register('dependentService', (container) => {
  const base = container.get('baseService');
  return new DependentService(base);
}, true);

test.assertDoesNotThrow(() => {
  const dependent = container1.get('dependentService');
  test.assertEqual(dependent.getDependencyValue(), 'Service: base', 'Dependency resolved correctly');
}, 'Dependent service resolves dependencies via container');

// =============================================================================
// Section 7: Error Handling
// =============================================================================

test.section('Error Handling');

container1.reset();

test.assertThrows(() => {
  container1.get('nonexistentService');
}, 'Getting unregistered service throws error');

test.assertThrows(() => {
  container1.register('badService', 'not a function', true);
}, 'Registering non-function factory throws error');

test.assertThrows(() => {
  container1.register('badService', null, true);
}, 'Registering null factory throws error');

// =============================================================================
// Section 8: Service Existence Checks
// =============================================================================

test.section('Service Existence Checks');

container1.reset();

test.assert(!container1.has('missingService'), 'has() returns false for missing service');

container1.register('existsService', () => new TestService('exists'), true);
test.assert(container1.has('existsService'), 'has() returns true for registered service');

// Service not yet instantiated
test.assert(container1.has('existsService'), 'has() returns true even before instantiation');

// Get and verify still registered
container1.get('existsService');
test.assert(container1.has('existsService'), 'has() returns true after instantiation');

// =============================================================================
// Section 9: Unregister Functionality
// =============================================================================

test.section('Unregister Functionality');

container1.reset();

container1.register('tempService', () => new TestService('temp'), true);
test.assert(container1.has('tempService'), 'Service is registered');

// Instantiate it
const tempInstance = container1.get('tempService');
test.assertNotNullish(tempInstance, 'Service can be retrieved');

// Unregister
container1.unregister('tempService');
test.assert(!container1.has('tempService'), 'Service is unregistered');

test.assertThrows(() => {
  container1.get('tempService');
}, 'Cannot get unregistered service');

// =============================================================================
// Section 10: Get Registered Services
// =============================================================================

test.section('Get Registered Services');

container1.reset();

const emptyServices = container1.getRegisteredServices();
test.assertArrayLength(emptyServices, 0, 'No services registered initially');

container1.register('service1', () => new TestService('1'), true);
container1.register('service2', () => new TestService('2'), true);
container1.register('service3', () => new TestService('3'), false);

const services = container1.getRegisteredServices();
test.assertArrayLength(services, 3, 'Returns all registered services');
test.assertContains(services, 'service1', 'Contains service1');
test.assertContains(services, 'service2', 'Contains service2');
test.assertContains(services, 'service3', 'Contains service3');

// =============================================================================
// Section 11: Reset Functionality
// =============================================================================

test.section('Reset Functionality - Full Reset');

container1.reset();

container1.register('resetTestService', () => new TestService('reset'), true);
const beforeReset = container1.get('resetTestService');
test.assertNotNullish(beforeReset, 'Service exists before reset');

container1.reset();

test.assert(!container1.has('resetTestService'), 'Service not registered after reset');
test.assertThrows(() => {
  container1.get('resetTestService');
}, 'Cannot get service after reset');

const registeredAfterReset = container1.getRegisteredServices();
test.assertArrayLength(registeredAfterReset, 0, 'No services registered after reset');

// =============================================================================
// Section 12: Reset Singletons Only
// =============================================================================

test.section('Reset Functionality - Reset Singletons Only');

container1.reset();

let singletonInitCount = 0;
container1.register('singletonResetTest', () => {
  singletonInitCount++;
  return new TestService(`init-${singletonInitCount}`);
}, true);

const first = container1.get('singletonResetTest');
test.assertEqual(singletonInitCount, 1, 'Service initialized once');
test.assertEqual(first.name, 'init-1', 'First instance has correct name');

const second = container1.get('singletonResetTest');
test.assertEqual(singletonInitCount, 1, 'Singleton not re-initialized');
test.assert(first === second, 'Same instance returned');

// Reset only singletons
container1.resetSingletons();

test.assert(container1.has('singletonResetTest'), 'Service still registered after resetSingletons');

const third = container1.get('singletonResetTest');
test.assertEqual(singletonInitCount, 2, 'Service re-initialized after resetSingletons');
test.assertEqual(third.name, 'init-2', 'New instance has different name');
test.assert(first !== third, 'Different instance after resetSingletons');

// =============================================================================
// Section 13: Complex Dependency Chain
// =============================================================================

test.section('Complex Dependency Chain');

container1.reset();

// Create a chain of dependencies: C depends on B, B depends on A
container1.register('serviceA', () => new TestService('A'), true);

container1.register('serviceB', (container) => {
  const a = container.get('serviceA');
  const service = new TestService('B');
  service.dependency = a;
  return service;
}, true);

container1.register('serviceC', (container) => {
  const b = container.get('serviceB');
  const service = new TestService('C');
  service.dependency = b;
  return service;
}, true);

test.assertDoesNotThrow(() => {
  const c = container1.get('serviceC');
  test.assertEqual(c.name, 'C', 'Service C loaded');
  test.assertEqual(c.dependency.name, 'B', 'Service C has dependency B');
  test.assertEqual(c.dependency.dependency.name, 'A', 'Service B has dependency A');
}, 'Complex dependency chain resolves correctly');

// =============================================================================
// Section 14: Mixed Singleton and Factory
// =============================================================================

test.section('Mixed Singleton and Factory Services');

container1.reset();

let singletonCount = 0;
let factoryCount = 0;

container1.register('mixedSingleton', () => {
  singletonCount++;
  return new TestService('singleton');
}, true);

container1.register('mixedFactory', () => {
  factoryCount++;
  return new TestService('factory');
}, false);

// Get services multiple times
container1.get('mixedSingleton');
container1.get('mixedSingleton');
container1.get('mixedFactory');
container1.get('mixedFactory');

test.assertEqual(singletonCount, 1, 'Singleton initialized once');
test.assertEqual(factoryCount, 2, 'Factory called twice');

// =============================================================================
// Section 15: Edge Cases
// =============================================================================

test.section('Edge Cases');

container1.reset();

// Empty service name
test.assertDoesNotThrow(() => {
  container1.register('', () => new TestService('empty'), true);
}, 'Can register service with empty string name');

test.assert(container1.has(''), 'Empty string is valid service name');

const emptyService = container1.get('');
test.assertNotNullish(emptyService, 'Can retrieve service with empty string name');

// Service returns null
container1.register('nullService', () => null, true);
const nullResult = container1.get('nullService');
test.assertNullish(nullResult, 'Service can return null');

// Service returns undefined
container1.register('undefinedService', () => undefined, true);
const undefinedResult = container1.get('undefinedService');
test.assertNullish(undefinedResult, 'Service can return undefined');

// Service returns primitive
container1.register('stringService', () => 'hello', true);
const stringResult = container1.get('stringService');
test.assertEqual(stringResult, 'hello', 'Service can return primitive value');

// Service returns function
const testFunc = () => 'test';
container1.register('functionService', () => testFunc, true);
const funcResult = container1.get('functionService');
test.assert(funcResult === testFunc, 'Service can return function');

// =============================================================================
// Test Summary
// =============================================================================

test.summary();
