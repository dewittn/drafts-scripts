/**
 * Year Count Unit Test
 *
 * Tests the "Nth year" counts behind hc_year and hc_years_coaching
 * (coachingSince and headCoachSince in bvr/staff.yaml.tpl): counting years
 * from a start date's anniversaries, and the ordinal suffixes.
 */

// Load test infrastructure (path is relative to Library/Scripts/)
require("../Tests/fixtures/assertions.js");
require("modules/bvr/utils/BVRUtilities.js");

const test = new TestAssertions("Year Count Tags");

// --- ordinal ---
test.section("ordinal");

const ordinals = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 9: "9th", 11: "11th", 12: "12th", 13: "13th", 21: "21st", 22: "22nd", 101: "101st", 111: "111th" };
for (const [number, expected] of Object.entries(ordinals)) {
  test.assertEqual(BVRUtilities.ordinal(Number(number)), expected, `${number} → ${expected}`);
}

// --- yearCount ---
test.section("yearCount");

const start = "2016-02-29";

test.assertEqual(BVRUtilities.yearCount(start, new Date(2016, 1, 29)), 1, "The start date is year 1");
test.assertEqual(BVRUtilities.yearCount(start, new Date(2016, 10, 1)), 1, "The fall after it is still year 1");
test.assertEqual(BVRUtilities.yearCount(start, new Date(2026, 10, 13)), 11, "Fall 2026 is year 11");
test.assertEqual(BVRUtilities.yearCount(start, new Date(2027, 1, 28)), 11, "The day before the anniversary is still year 11");
test.assertEqual(BVRUtilities.yearCount(start, new Date(2027, 2, 1)), 12, "A leap-day start rolls over on Mar 1 in other years");
test.assertEqual(BVRUtilities.yearCount("2023-03-06", new Date(2027, 2, 5)), 4, "Day before the anniversary → year 4");
test.assertEqual(BVRUtilities.yearCount("2023-03-06", new Date(2027, 2, 6)), 5, "The anniversary starts year 5");
test.assertEqual(BVRUtilities.yearCount(undefined), undefined, "No start date → undefined");
test.assertEqual(BVRUtilities.yearCount("2027-02-22", new Date(2026, 10, 13)), undefined, "A date still to come → undefined");

test.summary();
