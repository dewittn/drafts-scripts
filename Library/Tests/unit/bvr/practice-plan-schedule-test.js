/**
 * PracticePlan Schedule Unit Tests
 *
 * Covers which week a plan is for, the per-day calendar tags the plan
 * template reads ([[monday_schedule]] ...), and the order of the Delete
 * Practice Plan picker. Events are plain objects shaped like Drafts
 * CalendarEvents.
 */

require("../Tests/fixtures/assertions.js");
require("modules/bvr/core/PracticePlan.js");

const test = new TestAssertions("PracticePlan Schedule");

const ymd = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

// An event on the given day (month is 1-12).
const event = (title, [year, month, day], { hour = 14, notes = "" } = {}) => ({
  title,
  notes,
  isAllDay: false,
  startDate: new Date(year, month - 1, day, hour),
  endDate: new Date(year, month - 1, day, hour + 1),
});

// --- planMonday ---
test.section("planMonday");

test.assertEqual(ymd(PracticePlan.planMonday(new Date(2026, 10, 15, 9))), "2026-11-16", "Sunday plans the coming week");
test.assertEqual(ymd(PracticePlan.planMonday(new Date(2026, 10, 14, 9))), "2026-11-16", "Saturday plans the coming week");
test.assertEqual(ymd(PracticePlan.planMonday(new Date(2026, 10, 18, 9))), "2026-11-16", "Wednesday plans its own week");
test.assertEqual(
  PracticePlan.weekNumber("2026-11-16", PracticePlan.planMonday(new Date(2026, 10, 15, 9))),
  1,
  "a plan made the Sunday before the season starts is week 1, not week 0",
);

// --- describeEvent ---
test.section("describeEvent");

test.assertEqual(
  PracticePlan.describeEvent(event("Game: Home vs Newton", [2026, 11, 16], { notes: "Main Gym, 4:00" })),
  "Game: Home vs Newton (Main Gym, 4:00)",
  "a game shows its title and notes",
);
test.assertEqual(PracticePlan.describeEvent(event("No Practice", [2026, 11, 20])), "No Practice", "no notes, no parentheses");
test.assertEqual(
  PracticePlan.describeEvent(event(" No Practice ", [2026, 11, 20], { notes: "Thanksgiving\n\n break \n" })),
  "No Practice (Thanksgiving, break)",
  "note lines join with commas and are trimmed",
);

// --- scheduleTags ---
test.section("scheduleTags");

const monday = new Date(2026, 10, 16);
const events = [
  event("Practice", [2026, 11, 16]),
  event("Game: Away vs Derby", [2026, 11, 16], { hour: 16, notes: "Derby MS" }),
  event("Practice", [2026, 11, 17]),
  event("Team Photos", [2026, 11, 18], { hour: 15 }),
  event("No Practice", [2026, 11, 18], { hour: 8, notes: "Early release" }),
  event("No Practice", [2026, 11, 20], { notes: "Thanksgiving" }),
  event("Game: Home vs Newton", [2026, 11, 23]), // next week
];
const tags = PracticePlan.scheduleTags(events, monday);

test.assertDeepEqual(
  Object.keys(tags),
  ["monday_schedule", "tuesday_schedule", "wednesday_schedule", "thursday_schedule", "friday_schedule", "saturday_schedule", "sunday_schedule"],
  "one tag per day of the week",
);
test.assertEqual(tags.monday_schedule, "- Game: Away vs Derby (Derby MS)", "practice is left out of a game day");
test.assertEqual(tags.tuesday_schedule, "-", "a practice day keeps the empty bullet");
test.assertEqual(tags.wednesday_schedule, "- No Practice (Early release)\n- Team Photos", "several events, earliest first");
test.assertEqual(tags.thursday_schedule, "-", "a day with nothing on the calendar keeps the empty bullet");
test.assertEqual(tags.friday_schedule, "- No Practice (Thanksgiving)", "No Practice with its reason");
test.assertEqual(tags.sunday_schedule, "-", "events from the next week are left out");
test.assertEqual(PracticePlan.scheduleTags([], monday).monday_schedule, "-", "no calendar events, every day is a practice day");

// --- newestFirst ---
test.section("newestFirst");

test.assertDeepEqual(PracticePlan.newestFirst(["W0", "W10", "W2"]), ["W10", "W2", "W0"], "team file weeks, latest first");
test.assertDeepEqual(PracticePlan.newestFirst(["2026W3", "2026W11"]), ["2026W11", "2026W3"], "practicePlans.json keys too");

test.summary();
