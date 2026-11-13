/**
 * Year Count Unit Test
 *
 * Tests the "Nth year" template tags (yearCountTags in bvr/settings.yaml.tpl):
 * counting school years from a start date, and the ordinal suffixes.
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

// --- schoolYearCount ---
test.section("schoolYearCount");

const start = "2018-08-20";

test.assertEqual(BVRUtilities.schoolYearCount(start, new Date(2018, 8, 1)), 1, "The first fall is year 1");
test.assertEqual(BVRUtilities.schoolYearCount(start, new Date(2019, 2, 1)), 1, "The spring after it is still year 1");
test.assertEqual(BVRUtilities.schoolYearCount(start, new Date(2019, 6, 1)), 2, "July 1 starts year 2");
test.assertEqual(BVRUtilities.schoolYearCount(start, new Date(2026, 10, 13)), 9, "Fall 2026 is year 9");
test.assertEqual(BVRUtilities.schoolYearCount(start, new Date(2027, 1, 15)), 9, "Spring 2027 is still year 9");
test.assertEqual(BVRUtilities.schoolYearCount("2019-03-01", new Date(2019, 8, 1)), 2, "A spring start counts its school year as year 1");
test.assertEqual(BVRUtilities.schoolYearCount(undefined), undefined, "No start date → undefined");

// --- yearCountTags ---
test.section("yearCountTags");

test.assertEqual(
  BVRUtilities.yearCountTags({ hc_years_coaching: start }, new Date(2026, 10, 13)).hc_years_coaching,
  "9th",
  "hc_years_coaching from 2018-08-20 → 9th in fall 2026",
);
test.assertEqual(Object.keys(BVRUtilities.yearCountTags(undefined)).length, 0, "No settings → no tags");
test.assertEqual(Object.keys(BVRUtilities.yearCountTags({ empty: "" })).length, 0, "A blank date is skipped");

test.summary();
