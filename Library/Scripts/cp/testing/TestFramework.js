// TestFramework.js
// Simple test framework for running tests in Drafts environment

class TestFramework {
  #tests;
  #results;
  #currentSuite;

  constructor() {
    this.#tests = [];
    this.#results = {
      passed: 0,
      failed: 0,
      errors: [],
      suites: {},
    };
    this.#currentSuite = null;
  }

  // Define a test suite
  describe(suiteName, suiteFunc) {
    this.#currentSuite = suiteName;
    this.#results.suites[suiteName] = {
      passed: 0,
      failed: 0,
      tests: [],
    };

    try {
      suiteFunc();
    } catch (error) {
      this.#results.errors.push({
        suite: suiteName,
        error: error.message,
        stack: error.stack,
      });
    }

    this.#currentSuite = null;
  }

  // Define a test
  it(testName, testFunc) {
    if (!this.#currentSuite) {
      throw new Error("Tests must be defined within a describe() block");
    }

    this.#tests.push({
      suite: this.#currentSuite,
      name: testName,
      func: testFunc,
    });
  }

  // Run all tests
  async run() {
    console.log("=".repeat(60));
    console.log("Running Tests");
    console.log("=".repeat(60));

    for (const test of this.#tests) {
      try {
        await test.func();
        this.#recordPass(test);
      } catch (error) {
        this.#recordFail(test, error);
      }
    }

    this.#printResults();
    return this.#results;
  }

  #recordPass(test) {
    this.#results.passed++;
    this.#results.suites[test.suite].passed++;
    this.#results.suites[test.suite].tests.push({
      name: test.name,
      status: "passed",
    });
    console.log(`  ✓ ${test.suite} > ${test.name}`);
  }

  #recordFail(test, error) {
    this.#results.failed++;
    this.#results.suites[test.suite].failed++;
    this.#results.suites[test.suite].tests.push({
      name: test.name,
      status: "failed",
      error: error.message,
    });
    this.#results.errors.push({
      suite: test.suite,
      test: test.name,
      error: error.message,
      stack: error.stack,
    });
    console.log(`  ✗ ${test.suite} > ${test.name}`);
    console.log(`    Error: ${error.message}`);
  }

  #printResults() {
    console.log("\n" + "=".repeat(60));
    console.log("Test Results");
    console.log("=".repeat(60));

    for (const [suiteName, suite] of Object.entries(this.#results.suites)) {
      const total = suite.passed + suite.failed;
      console.log(
        `\n${suiteName}: ${suite.passed}/${total} passed (${suite.failed} failed)`
      );
    }

    const total = this.#results.passed + this.#results.failed;
    console.log("\n" + "-".repeat(60));
    console.log(
      `Total: ${this.#results.passed}/${total} passed (${this.#results.failed} failed)`
    );

    if (this.#results.failed > 0) {
      console.log("\n" + "=".repeat(60));
      console.log("Failures:");
      console.log("=".repeat(60));
      for (const error of this.#results.errors) {
        console.log(`\n${error.suite} > ${error.test}`);
        console.log(`  ${error.error}`);
      }
    }

    console.log("\n" + "=".repeat(60));
  }

  // Get test results
  getResults() {
    return this.#results;
  }
}

// Assertion helpers
class Assert {
  static equal(actual, expected, message = "") {
    if (actual !== expected) {
      throw new Error(
        message ||
          `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
      );
    }
  }

  static notEqual(actual, expected, message = "") {
    if (actual === expected) {
      throw new Error(
        message ||
          `Expected value to not equal ${JSON.stringify(expected)}`
      );
    }
  }

  static strictEqual(actual, expected, message = "") {
    if (actual !== expected) {
      throw new Error(
        message ||
          `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`
      );
    }
  }

  static deepEqual(actual, expected, message = "") {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
      throw new Error(
        message || `Expected ${expectedStr} but got ${actualStr}`
      );
    }
  }

  static isTrue(value, message = "") {
    if (value !== true) {
      throw new Error(message || `Expected true but got ${value}`);
    }
  }

  static isFalse(value, message = "") {
    if (value !== false) {
      throw new Error(message || `Expected false but got ${value}`);
    }
  }

  static isNull(value, message = "") {
    if (value !== null) {
      throw new Error(message || `Expected null but got ${value}`);
    }
  }

  static isNotNull(value, message = "") {
    if (value === null) {
      throw new Error(message || "Expected value to not be null");
    }
  }

  static isUndefined(value, message = "") {
    if (value !== undefined) {
      throw new Error(message || `Expected undefined but got ${value}`);
    }
  }

  static isNotUndefined(value, message = "") {
    if (value === undefined) {
      throw new Error(message || "Expected value to not be undefined");
    }
  }

  static throws(func, expectedError = null, message = "") {
    let didThrow = false;
    let thrownError = null;

    try {
      func();
    } catch (error) {
      didThrow = true;
      thrownError = error;
    }

    if (!didThrow) {
      throw new Error(message || "Expected function to throw an error");
    }

    if (expectedError && !thrownError.message.includes(expectedError)) {
      throw new Error(
        message ||
          `Expected error to include "${expectedError}" but got "${thrownError.message}"`
      );
    }
  }

  static async throwsAsync(func, expectedError = null, message = "") {
    let didThrow = false;
    let thrownError = null;

    try {
      await func();
    } catch (error) {
      didThrow = true;
      thrownError = error;
    }

    if (!didThrow) {
      throw new Error(message || "Expected function to throw an error");
    }

    if (expectedError && !thrownError.message.includes(expectedError)) {
      throw new Error(
        message ||
          `Expected error to include "${expectedError}" but got "${thrownError.message}"`
      );
    }
  }

  static contains(collection, item, message = "") {
    if (Array.isArray(collection)) {
      if (!collection.includes(item)) {
        throw new Error(
          message ||
            `Expected array to contain ${JSON.stringify(item)}`
        );
      }
    } else if (typeof collection === "string") {
      if (!collection.includes(item)) {
        throw new Error(
          message || `Expected string to contain "${item}"`
        );
      }
    } else {
      throw new Error("Collection must be an array or string");
    }
  }

  static hasProperty(obj, property, message = "") {
    if (!(property in obj)) {
      throw new Error(
        message || `Expected object to have property "${property}"`
      );
    }
  }

  static isType(value, type, message = "") {
    const actualType = typeof value;
    if (actualType !== type) {
      throw new Error(
        message || `Expected type ${type} but got ${actualType}`
      );
    }
  }

  static lengthEquals(collection, expectedLength, message = "") {
    const actualLength = collection.length;
    if (actualLength !== expectedLength) {
      throw new Error(
        message ||
          `Expected length ${expectedLength} but got ${actualLength}`
      );
    }
  }
}