/**
 * Test Assertions Helper
 *
 * Provides a simple assertion framework for console-based testing in Drafts.
 * Tests fail by throwing errors and logging detailed failure messages.
 *
 * Usage:
 *   const test = new TestAssertions('My Test Suite');
 *   test.assert(condition, 'Description');
 *   test.assertEqual(actual, expected, 'Description');
 *   test.summary(); // Throws if any test failed
 */

class TestAssertions {
  /**
   * @param {string} testName - Name of the test suite
   */
  constructor(testName) {
    this.testName = testName;
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
    this.startTime = Date.now();

    console.log('='.repeat(60));
    console.log(`Running: ${testName}`);
    console.log('='.repeat(60));
  }

  /**
   * Assert that a condition is true
   * @param {boolean} condition - Condition to test
   * @param {string} message - Test description
   */
  assert(condition, message) {
    if (condition) {
      console.log(`✅ ${message}`);
      this.passed++;
    } else {
      const error = `❌ ${message}`;
      console.log(error);
      this.errors.push(error);
      this.failed++;
    }
  }

  /**
   * Assert that two values are strictly equal
   * @param {*} actual - Actual value
   * @param {*} expected - Expected value
   * @param {string} message - Test description
   */
  assertEqual(actual, expected, message) {
    const condition = actual === expected;
    if (!condition) {
      message += ` (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`;
    }
    this.assert(condition, message);
  }

  /**
   * Assert that two values are deeply equal (for objects/arrays)
   * @param {*} actual - Actual value
   * @param {*} expected - Expected value
   * @param {string} message - Test description
   */
  assertDeepEqual(actual, expected, message) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    const condition = actualJson === expectedJson;
    if (!condition) {
      message += `\n  Expected: ${expectedJson}\n  Got: ${actualJson}`;
    }
    this.assert(condition, message);
  }

  /**
   * Assert that a value is truthy
   * @param {*} value - Value to test
   * @param {string} message - Test description
   */
  assertTruthy(value, message) {
    this.assert(!!value, message);
  }

  /**
   * Assert that a value is falsy
   * @param {*} value - Value to test
   * @param {string} message - Test description
   */
  assertFalsy(value, message) {
    this.assert(!value, message);
  }

  /**
   * Assert that a function throws an error
   * @param {Function} fn - Function to test
   * @param {string} message - Test description
   * @param {string} [expectedError] - Optional expected error message substring
   */
  assertThrows(fn, message, expectedError = null) {
    try {
      fn();
      this.assert(false, message + ' (no error thrown)');
    } catch (e) {
      if (expectedError && !e.message.includes(expectedError)) {
        this.assert(false, message + ` (expected error containing "${expectedError}", got: "${e.message}")`);
      } else {
        this.assert(true, message);
      }
    }
  }

  /**
   * Assert that a function does not throw an error
   * @param {Function} fn - Function to test
   * @param {string} message - Test description
   */
  assertDoesNotThrow(fn, message) {
    try {
      fn();
      this.assert(true, message);
    } catch (e) {
      this.assert(false, message + ` (unexpected error: ${e.message})`);
    }
  }

  /**
   * Assert that a value is null or undefined
   * @param {*} value - Value to test
   * @param {string} message - Test description
   */
  assertNullish(value, message) {
    this.assert(value === null || value === undefined, message);
  }

  /**
   * Assert that a value is not null or undefined
   * @param {*} value - Value to test
   * @param {string} message - Test description
   */
  assertNotNullish(value, message) {
    this.assert(value !== null && value !== undefined, message);
  }

  /**
   * Assert that an array includes a value
   * @param {Array} array - Array to test
   * @param {*} value - Value to find
   * @param {string} message - Test description
   */
  assertIncludes(array, value, message) {
    const condition = Array.isArray(array) && array.includes(value);
    if (!condition) {
      message += ` (array does not include ${JSON.stringify(value)})`;
    }
    this.assert(condition, message);
  }

  /**
   * Assert that an object has a property
   * @param {Object} obj - Object to test
   * @param {string} property - Property name
   * @param {string} message - Test description
   */
  assertHasProperty(obj, property, message) {
    const condition = obj && Object.prototype.hasOwnProperty.call(obj, property);
    if (!condition) {
      message += ` (object missing property "${property}")`;
    }
    this.assert(condition, message);
  }

  /**
   * Assert that a value is of a specific type
   * @param {*} value - Value to test
   * @param {string} type - Expected type (typeof result or class name)
   * @param {string} message - Test description
   */
  assertType(value, type, message) {
    const actualType = typeof value === 'object' && value !== null
      ? value.constructor.name
      : typeof value;
    const condition = actualType === type;
    if (!condition) {
      message += ` (expected type ${type}, got ${actualType})`;
    }
    this.assert(condition, message);
  }

  /**
   * Print a section header
   * @param {string} sectionName - Section name
   */
  section(sectionName) {
    console.log(`\n--- ${sectionName} ---`);
  }

  /**
   * Log an info message (doesn't count as a test)
   * @param {string} message - Message to log
   */
  info(message) {
    console.log(`ℹ️  ${message}`);
  }

  /**
   * Print test summary and throw if any tests failed
   */
  summary() {
    const duration = Date.now() - this.startTime;

    console.log('\n' + '='.repeat(60));
    console.log(`Test Summary: ${this.testName}`);
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    if (this.failed > 0) {
      console.log('\n' + '⚠️  Failed Tests:');
      this.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
      console.log('='.repeat(60));
      throw new Error(`${this.failed} test(s) failed in ${this.testName}`);
    } else {
      console.log('\n✨ All tests passed!');
      console.log('='.repeat(60));
    }
  }
}

// Export for use in test files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TestAssertions;
}
