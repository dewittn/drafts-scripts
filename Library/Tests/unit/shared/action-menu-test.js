/**
 * ActionMenu Unit Tests
 *
 * Covers building a menu from a list of action names when some of the names
 * have no matching action in Drafts.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/ActionMenu.js");

const test = new TestAssertions("ActionMenu");

const installed = ["Record Attendace", "Bus Home"];
/** @type {any} */ (globalThis).Action = {
  find: (name) => (installed.includes(name) ? { name } : undefined),
};

let warnings = [];
/** @type {any} */ (globalThis).app = { displayWarningMessage: (message) => warnings.push(message) };

// --- missing actions ---
test.section("missing actions");

const menu = ActionMenu.createFromList(["Record Attendace", "Bus Ride Home", "Bus Home", "Edit Game"]);
test.assertDeepEqual(
  menu.menuSettings.menuItems.map((item) => item.data.name),
  ["Record Attendace", "Bus Home"],
  "leaves actions Drafts does not have out of the menu"
);
test.assertDeepEqual(warnings, ["Actions not found: Bus Ride Home, Edit Game"], "warns once, naming each missing action");

warnings = [];
ActionMenu.createFromList(installed);
test.assertDeepEqual(warnings, [], "does not warn when every action is found");

test.summary();
