/**
 * WeeklySchedule Unit Tests
 *
 * Covers picking the week, wording each calendar event, filling in days with
 * no events, the sign-off, and the game title parser shared with Game.
 * Events are plain objects shaped like Drafts CalendarEvents.
 */

require("../Tests/fixtures/assertions.js");
require("modules/bvr/core/WeeklySchedule.js");

const test = new TestAssertions("WeeklySchedule");

const wording = {
  practice: "practice, {time}",
  game: "game, {location} vs. {opponent} {details}",
  missingGameDetails: "{--add the field and time to the event notes--}",
  noPractice: "**No Practice**",
  noPracticeWithReason: "**No Practice** ({reason})",
  emptyDay: "{--nothing on the calendar--}",
  lastWeekGame: "{day}, {result} vs {opponent}, {score}",
  noGamesLastWeek: "No games",
  practiceTime: "2:35 - 3:35",
};

const ymd = (date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

// An event on the given day (month is 1-12), at the given 24-hour times.
const event = (title, [year, month, day], { start = "14:20", end = "15:35", notes = "", isAllDay = false } = {}) => {
  const at = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  };
  return { title, notes, isAllDay, startDate: at(start), endDate: at(end) };
};

// --- scheduleMonday ---
test.section("scheduleMonday");

test.assertEqual(ymd(WeeklySchedule.scheduleMonday(new Date(2026, 10, 15, 9))), "2026-11-16", "Sunday gives the next day");
test.assertEqual(ymd(WeeklySchedule.scheduleMonday(new Date(2026, 10, 14, 9))), "2026-11-16", "Saturday gives the coming Monday");
test.assertEqual(ymd(WeeklySchedule.scheduleMonday(new Date(2026, 10, 30, 9))), "2026-11-30", "Monday gives itself");
test.assertEqual(ymd(WeeklySchedule.scheduleMonday(new Date(2026, 11, 3, 9))), "2026-11-30", "a weekday gives its own week");
test.assertEqual(WeeklySchedule.scheduleMonday(new Date(2026, 10, 15, 9)).getHours(), 0, "the Monday is at midnight");
test.assertEqual(ymd(WeeklySchedule.addDays(new Date(2026, 10, 30), 7)), "2026-12-7", "addDays crosses months");
test.assertEqual(WeeklySchedule.shortDate(new Date(2026, 10, 30)), "Nov 30", "shortDate");
test.assertEqual(WeeklySchedule.dayName(new Date(2026, 10, 6, 9)), "Friday", "dayName for a weekday");
test.assertEqual(WeeklySchedule.dayName(new Date(2026, 10, 8, 23)), "Sunday", "dayName for a Sunday");

// --- describeEvent ---
test.section("describeEvent");

const describe = (calendarEvent, words = wording) => WeeklySchedule.describeEvent(calendarEvent, words);

test.assertEqual(describe(event("Practice", [2026, 11, 16])), "practice, 2:35 - 3:35", "practice prints the set time");
test.assertEqual(
  describe(event("Practice", [2026, 11, 16]), { ...wording, practiceTime: undefined }),
  "practice, 2:20 - 3:35",
  "without a set time, practice prints the calendar's",
);
test.assertEqual(
  describe(event("Game: Home vs Milton (B)", [2026, 11, 18], { notes: "@ Soule, 3:30 pm" })),
  "game, Home vs. Milton (B) @ Soule, 3:30 pm",
  "a game reads its field and time from the notes",
);
test.assertEqual(
  describe(event("Game: Away vs Winsor (B)", [2026, 11, 18])),
  "game, Away vs. Winsor (B) {--add the field and time to the event notes--}",
  "a game without notes is flagged",
);
test.assertEqual(
  describe(event("No Practice", [2026, 11, 20], { notes: "conferences" })),
  "**No Practice** (conferences)",
  "No Practice reads its reason from the notes",
);
test.assertEqual(describe(event("no practice", [2026, 11, 20])), "**No Practice**", "No Practice without notes");
test.assertEqual(
  describe(event("Team Dinner", [2026, 11, 20], { start: "18:00", end: "19:30" })),
  "Team Dinner, 6:00 - 7:30",
  "other events print their title and time",
);
test.assertEqual(describe(event("Tournament", [2026, 11, 21], { isAllDay: true })), "Tournament", "all-day events print just the title");

// --- buildDays ---
test.section("buildDays");

const monday = new Date(2026, 10, 30);
const week = [
  event("Practice", [2026, 11, 30]),
  event("Game: Home vs Milton (B)", [2026, 12, 2], { notes: "@ Soule, 3:30 pm" }),
  event("Practice", [2026, 12, 3]),
  event("No Practice", [2026, 12, 4], { notes: "conferences", isAllDay: true }),
];
const days = WeeklySchedule.buildDays(week, monday, wording);

test.assertDeepEqual(
  days,
  [
    { day: "Monday", description: "practice, 2:35 - 3:35" },
    { day: "Tuesday", description: "{--nothing on the calendar--}" },
    { day: "Wednesday", description: "game, Home vs. Milton (B) @ Soule, 3:30 pm" },
    { day: "Thursday", description: "practice, 2:35 - 3:35" },
    { day: "Friday", description: "**No Practice** (conferences)" },
  ],
  "one line per school day, a flag for a day with nothing, no empty weekend days",
);

const weekend = WeeklySchedule.buildDays([event("Tournament", [2026, 12, 5], { isAllDay: true })], monday, wording);
test.assertDeepEqual(weekend[5], { day: "Saturday", description: "Tournament" }, "a weekend day with an event is listed");

const doubleDay = WeeklySchedule.buildDays(
  [event("Game: Away vs Thayer (B)", [2026, 11, 30], { start: "16:00", notes: "@ Thayer, 4 pm" }), event("Practice", [2026, 11, 30])],
  monday,
  wording,
);
test.assertEqual(
  doubleDay[0].description,
  "practice, 2:35 - 3:35; game, Away vs. Thayer (B) @ Thayer, 4 pm",
  "two events on a day are joined in time order",
);

// --- lastWeek ---
test.section("lastWeek");

// A recorded game as the team file stores it, read back through Game.
const played = ([year, month, day], opponent, score, extra = {}) =>
  Game.fromJSON(undefined, {
    date: new Date(year, month - 1, day, 17).toISOString(),
    opponent,
    score,
    result: Game.winLoseOrDraw(score),
    recorded: true,
    ...extra,
  });

const nov30 = new Date(2026, 10, 30);
const season = [
  played([2026, 11, 2], "Winsor", ["1", "0"]),
  played([2026, 11, 25], "Belmont", ["1", "2"]),
  played([2026, 11, 23], "Newton", ["5", "2"]),
  played([2026, 11, 24], "Not Recorded", ["0", "0"], { recorded: false }),
  played([2026, 12, 2], "Next Week", ["3", "0"]),
];

test.assertDeepEqual(
  WeeklySchedule.lastWeek(season, nov30, wording),
  {
    games: [{ line: "Monday, Win vs Newton, 5 - 2" }, { line: "Wednesday, Loss vs Belmont, 1 - 2" }],
    record: "2-1",
    record_words: "2 wins, 1 loss",
  },
  "last week's recorded games in date order, and the record before monday",
);
test.assertDeepEqual(
  WeeklySchedule.lastWeek([played([2026, 11, 2], "Winsor", ["1", "0"])], nov30, wording),
  { games: [{ line: "No games" }], record: "1-0", record_words: "1 win, 0 losses" },
  "a week with no games still shows the record",
);
test.assertEqual(WeeklySchedule.lastWeek([], nov30, wording), undefined, "no recorded games leaves the list out");
test.assertEqual(
  WeeklySchedule.lastWeek([played([2026, 12, 2], "Next Week", ["3", "0"])], nov30, wording),
  undefined,
  "games after monday do not count",
);

test.assertEqual(
  WeeklySchedule.lastWeekText(WeeklySchedule.lastWeek(season, nov30, wording)),
  "Last Week:\n- Monday, Win vs Newton, 5 - 2\n- Wednesday, Loss vs Belmont, 1 - 2\n- Season Record: 2-1",
  "lastWeekText lists the games and the record, as the email does",
);

// --- seasonProgress ---
test.section("seasonProgress");

// A season of Mondays Sep 7 to Nov 2, ending Friday Nov 6: 9 weeks.
const progress = (monday) => WeeklySchedule.seasonProgress("2026-09-07", "2026-11-06", monday);
test.assertEqual(progress(new Date(2026, 8, 7)), "This is week 1 of 9, with 8 more weeks after this one.", "the first week");
test.assertEqual(progress(new Date(2026, 9, 26)), "This is week 8 of 9, with 1 more week after this one.", "one week left, singular");
test.assertEqual(progress(new Date(2026, 10, 2)), "This is the final week of the season (week 9 of 9).", "the final week");
test.assertEqual(progress(new Date(2026, 10, 9)), undefined, "a week after the season");
test.assertEqual(progress(new Date(2026, 7, 31)), undefined, "a week before the season");
test.assertEqual(WeeklySchedule.seasonProgress("2026-09-07", undefined, nov30), undefined, "no end date, no progress");

// --- record ---
test.section("record");

test.assertEqual(WeeklySchedule.record(season), "3-1", "draws are left off while there are none");
test.assertEqual(
  WeeklySchedule.record([...season, played([2026, 11, 9], "Thayer", ["2", "2"])]),
  "3-1-1",
  "draws show once there is one",
);
test.assertEqual(
  WeeklySchedule.recordWords([...season, played([2026, 11, 9], "Thayer", ["2", "2"])]),
  "3 wins, 1 loss, 1 draw",
  "recordWords spells out the record, singular for one",
);
test.assertEqual(WeeklySchedule.recordWords(season), "3 wins, 1 loss", "recordWords leaves out draws while there are none");

// --- signOff ---
test.section("signOff");

test.assertEqual(WeeklySchedule.signOff(["Coach Nelson"]), "Coach Nelson", "one coach");
test.assertEqual(WeeklySchedule.signOff(["Coach Koch", "Coach Nelson"]), "Coach Koch and Coach Nelson", "two coaches");
test.assertEqual(WeeklySchedule.signOff(["A", "B", "C"]), "A, B and C", "three coaches");
test.assertEqual(WeeklySchedule.signOff([]), "", "no coaches");

// --- Game.parseCalendarTitle ---
test.section("Game.parseCalendarTitle");

test.assertDeepEqual(
  Game.parseCalendarTitle("Game: Away vs Winsor (B)"),
  { location: "Away", opponent: "Winsor (B)" },
  "reads location and opponent",
);
test.assertEqual(Game.parseCalendarTitle("Practice"), undefined, "not a game");
test.assertEqual(Game.parseCalendarTitle("Game"), undefined, "a game title with no details");
test.assertEqual(Game.parseCalendarTitle(undefined), undefined, "no title");

test.summary();
