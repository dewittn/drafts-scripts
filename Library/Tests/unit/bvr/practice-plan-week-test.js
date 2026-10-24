/**
 * PracticePlan Week Calculation Unit Test
 *
 * Tests the ISO-week-based season week calculation, through PracticePlan's
 * own isoMonday and weekNumber statics.
 */

// Load test infrastructure (path is relative to Library/Scripts/)
require("../Tests/fixtures/assertions.js");
require("modules/bvr/core/PracticePlan.js");

const pad = (value) => `${value}`.padStart(2, "0");
const ymd = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getISOMonday = (date) => PracticePlan.isoMonday(date);

// weekNumber takes the start date as "YYYY-MM-DD", as seasons store it.
const getCurrentWeek = (currentDate, startDate) => PracticePlan.weekNumber(ymd(startDate), currentDate);

const test = new TestAssertions("PracticePlan Week Calculation");

// --- getISOMonday ---
test.section("getISOMonday");

// Monday returns itself
test.assertEqual(
  getISOMonday(new Date(2026, 2, 2)), // Mon Mar 2, 2026
  Date.UTC(2026, 2, 2),
  "Monday returns itself (Mar 2, 2026)",
);

// Thursday rolls back to Monday
test.assertEqual(
  getISOMonday(new Date(2026, 2, 19)), // Thu Mar 19, 2026
  Date.UTC(2026, 2, 16),
  "Thursday Mar 19 → Monday Mar 16",
);

// Sunday rolls back to previous Monday
test.assertEqual(
  getISOMonday(new Date(2026, 2, 22)), // Sun Mar 22, 2026
  Date.UTC(2026, 2, 16),
  "Sunday Mar 22 → Monday Mar 16",
);

// Saturday rolls back to Monday
test.assertEqual(
  getISOMonday(new Date(2026, 2, 21)), // Sat Mar 21, 2026
  Date.UTC(2026, 2, 16),
  "Saturday Mar 21 → Monday Mar 16",
);

// --- Season week calculation ---
test.section("Season Week (start: Mar 2, 2026)");

const seasonStart = new Date(2026, 2, 2); // Mon Mar 2, 2026

// Week 1: same week as start
test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 2), seasonStart),
  1,
  "Mar 2 (Mon, start day) → week 1",
);

test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 6), seasonStart),
  1,
  "Mar 6 (Fri, same week) → week 1",
);

test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 8), seasonStart),
  1,
  "Mar 8 (Sun, same week) → week 1",
);

// Week 2
test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 9), seasonStart),
  2,
  "Mar 9 (Mon, next week) → week 2",
);

// Week 3
test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 16), seasonStart),
  3,
  "Mar 16 (Mon) → week 3",
);

// Week 3: mid-week
test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 19), seasonStart),
  3,
  "Mar 19 (Thu) → week 3",
);

// Week 4
test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 23), seasonStart),
  4,
  "Mar 23 (Mon) → week 4",
);

test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 25), seasonStart),
  4,
  "Mar 25 (Wed) → week 4",
);

// --- Edge: start date is not a Monday ---
test.section("Season start on non-Monday");

const wedStart = new Date(2026, 2, 4); // Wed Mar 4, 2026

test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 4), wedStart),
  1,
  "Start Wed Mar 4, current Wed Mar 4 → week 1",
);

test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 8), wedStart),
  1,
  "Start Wed Mar 4, current Sun Mar 8 → week 1 (same ISO week)",
);

test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 9), wedStart),
  2,
  "Start Wed Mar 4, current Mon Mar 9 → week 2",
);

// --- ISO date string parsing (timezone bug) ---
test.section("ISO Date String Parsing");

// new Date("2026-03-02") parses as UTC midnight, which becomes
// Mar 1 in US timezones. Parsing via split avoids this.
function parseLocalDate(dateStr) {
  const parts = dateStr.split("-");
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

const stringStart = parseLocalDate("2026-03-02");

test.assertEqual(
  stringStart.getDate(),
  2,
  'parseLocalDate("2026-03-02") → local day is 2 (not 1)',
);

test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 19), stringStart),
  3,
  "String-parsed start 2026-03-02, Mar 19 → week 3",
);

test.assertEqual(
  getCurrentWeek(new Date(2026, 2, 23), stringStart),
  4,
  "String-parsed start 2026-03-02, Mar 23 → week 4",
);

// --- Year boundary ---
test.section("Year Boundary");

const decStart = new Date(2025, 11, 29); // Mon Dec 29, 2025

test.assertEqual(
  getCurrentWeek(new Date(2026, 0, 5), decStart),
  2,
  "Start Dec 29 2025, current Jan 5 2026 → week 2",
);

test.summary();
