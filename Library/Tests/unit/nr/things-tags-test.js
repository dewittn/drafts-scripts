/**
 * ThingsTags Unit Tests
 *
 * Covers the tags the Insert Things actions type, that ThingsParser reads them
 * back, and the Insert Things When prompt in nr-settings.yaml.
 */

require("../Tests/fixtures/assertions.js");
require("modules/nr/ThingsTags.js");
require("modules/nr/ThingsParser.js");

const test = new TestAssertions("ThingsTags");

const pad = (n) => String(n).padStart(2, "0");
/** @type {any} */ (globalThis).strftime = (date, format) =>
  format
    .replace("%Y", date.getFullYear())
    .replace("%m", pad(date.getMonth() + 1))
    .replace("%d", pad(date.getDate()))
    .replace("%H", pad(date.getHours()))
    .replace("%M", pad(date.getMinutes()));

/** @type {any} */ (globalThis).TJSTodo = { create: () => ({ addChecklistItem() {} }) };

const picked = new Date(2026, 10, 3, 9, 5);

// --- tags ---
test.section("tags");

test.assertEqual(ThingsTags.area("BVR Coaching"), "@area(BVR Coaching)", "builds an area tag");
test.assertEqual(ThingsTags.when(picked), "@when(2026-11-03)", "uses only the day without a reminder");
test.assertEqual(ThingsTags.when(picked, false), "@when(2026-11-03)", "ignores the time when the reminder is off");
test.assertEqual(ThingsTags.when(picked, true), "@when(2026-11-03@09:05)", "adds the 24-hour time for a reminder");

// --- read back by ThingsParser ---
test.section("read back by ThingsParser");

const line = `- [ ] Call the vet ${ThingsTags.when(picked, true)} ${ThingsTags.area("Sanity")}`;
const [todo] = new ThingsParser().parse(ThingsParser.fromChecklist(line).todos);
test.assertEqual(todo.title, "Call the vet", "keeps the title clean");
test.assertEqual(todo.when, "2026-11-03@09:05", "passes the reminder time to Things");
test.assertEqual(todo.list, "Sanity", "files it in the area");

// --- prompt settings ---
test.section("prompt settings");

const { whenMenu } = loadRepoYAML("nr-settings.yaml").things;
const fields = Object.fromEntries(whenMenu.menuItems.map((item) => [item.data.name, item]));
test.assertEqual(fields.when.type, "datePicker", "asks for the date with a date picker");
test.assertEqual(fields.when.data.options.mode, "dateAndTime", "lets the time be picked too");
test.assertEqual(fields.reminder.type, "switch", "asks about the reminder with a switch");
test.assertEqual(fields.reminder.data.initialValue, false, "starts with the reminder off");

test.summary();
