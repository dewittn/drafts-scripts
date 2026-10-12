/**
 * Settings Unit Tests
 *
 * Reads the real cp settings files through the test runner's FileManager stub
 * and checks property access alongside the load(key) lookup.
 */

require("../Tests/fixtures/assertions.js");
require("modules/cp/filesystems/CloudFS.js");

const test = new TestAssertions("Settings");

test.section("Whole file");

const settings = new Settings("cp/settings.yaml");
test.assertNotNullish(settings.defaultTag, "keys are readable as properties");
test.assertEqual(settings.load("defaultTag"), settings.defaultTag, "load(key) returns the same value as the property");
test.assertEqual(settings.load("statuses"), settings.statuses, "load(key) returns nested sections by reference");
test.assertThrows(() => settings.load("noSuchKey"), "load(key) throws on a missing key", '"noSuchKey" not found in cp/settings.yaml');
test.assertThrows(() => settings.load("ui"), "load(key) ignores getters on the class", '"ui" not found');

test.section("Section");

const tables = new Settings("cp/tables.yaml", "p2heblo7m5mzdtd");
test.assertEqual(tables.load("Content"), "mciuj7i0jj1bl11", "load(key) reads from the section");
test.assertThrows(() => tables.load("Nope"), "error names the file and section", "cp/tables.yaml [p2heblo7m5mzdtd]");

test.section("Static load");

test.assertEqual(Settings.load("cp/tables.yaml").p2heblo7m5mzdtd.Projects, "m0pf5kvjy8549qu", "static load(fileName) still reads a whole file");

test.summary();
