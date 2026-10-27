/**
 * Bear Unit Tests
 *
 * Stubs Credential, device, and app.openURL to check that the API token is
 * stored per device and sent with open-tag. The real API is only exercised
 * inside Drafts.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/bear.js");

const test = new TestAssertions("Bear");

let credentialsCreated = [];
let storedToken = "secret";
/** @type {any} */ (globalThis).Credential = {
  create: (name) => {
    credentialsCreated.push(name);
    return {
      addPasswordField() {},
      authorize: () => true,
      getValue: () => storedToken,
    };
  },
};

let openedURLs = [];
let errors = [];
/** @type {any} */ (globalThis).app = {
  openURL: (url) => {
    openedURLs.push(url);
    return true;
  },
  displayErrorMessage: (message) => errors.push(message),
};
/** @type {any} */ (globalThis).context = { cancel() {} };
/** @type {any} */ (globalThis).device = { model: "iPhone" };

function reset() {
  credentialsCreated = [];
  openedURLs = [];
  errors = [];
  storedToken = "secret";
}

test.section("token");

reset();
test.assertEqual(Bear.create().token, "secret", "reads the stored token");
test.assertDeepEqual(credentialsCreated, ["Bear (iPhone)"], "names the credential after the device model");

reset();
/** @type {any} */ (globalThis).device = { model: "Mac" };
Bear.create().token;
test.assertDeepEqual(credentialsCreated, ["Bear (Mac)"], "uses a separate credential on each device");

test.section("openTag");

reset();
Bear.create().openTag("Reference/Ideas/Spark Notes/2026");
test.assertDeepEqual(
  openedURLs,
  ["bear://x-callback-url/open-tag?name=Reference%2FIdeas%2FSpark%20Notes%2F2026&token=secret"],
  "opens the tag with the device's token",
);

reset();
storedToken = "";
const result = Bear.create().openTag("Reference");
test.assertEqual(result, false, "returns false without a token");
test.assertDeepEqual(errors, ["Bear API token is required!"], "says the token is missing");
test.assertEqual(openedURLs.length, 0, "opens nothing");

test.summary();
