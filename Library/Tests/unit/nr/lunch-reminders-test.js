/**
 * LunchMenu and LunchReminders Unit Tests
 *
 * Covers reading a lunch menu draft into days, which days are offered, and
 * the Things to-dos the create() flow sends, with a mock UI and stubbed TJS.
 */

require("../Tests/fixtures/assertions.js");
require("modules/nr/LunchReminders.js");

const test = new TestAssertions("LunchReminders");

const menu = `# Lunch Menu: Nov 16 to Nov 20, 2026

----
## Monday, November 16

----
## Tuesday, November 17
**Main Entree**
- Roasted Chicken Wings

**Sides**
- Steamed Rice

----
## Friday, November 20
**Menu**
- (image only: https://example.com/440684)

**Main Entree**
- Pork Carnitas
- Topping Bar`;

// --- LunchMenu.parse ---
test.section("LunchMenu.parse");

const days = LunchMenu.parse(menu);
test.assertEqual(days.length, 3, "returns every day header");
test.assertEqual(days[0].items.length, 0, "a blank day has no items");
test.assertEqual(days[1].weekday, "Tuesday", "keeps the weekday name");
test.assertEqual(days[1].date.getTime(), new Date(2026, 10, 17).getTime(), "dates the day from its header and the title's year");
test.assertDeepEqual(days[1].items, ["Roasted Chicken Wings", "Steamed Rice"], "lists the items without the dash");
test.assertEqual(days[1].notes, "**Main Entree**\n- Roasted Chicken Wings\n\n**Sides**\n- Steamed Rice", "keeps the day's menu as notes");
test.assertDeepEqual(days[2].items, ["Pork Carnitas", "Topping Bar"], "leaves out image-only items");
test.assertEqual(days[2].notes, "**Main Entree**\n- Pork Carnitas\n- Topping Bar", "drops a heading whose items were all left out");
test.assertDeepEqual(LunchMenu.parse("# Notes\n## Monday, November 16\n- Soup"), [], "returns nothing without a week in the title");

const wrap = LunchMenu.parse("# Lunch Menu: Dec 28 to Jan 1, 2027\n## Monday, December 28\n- Soup\n## Friday, January 1\n- Stew");
test.assertEqual(wrap[0].date.getFullYear(), 2026, "starts a week that crosses New Year in the earlier year");
test.assertEqual(wrap[1].date.getFullYear(), 2027, "moves January days into the next year");

// --- upcomingDays ---
test.section("upcomingDays");

const offered = (now) => LunchReminders.upcomingDays(days, now, "11:00").map((day) => day.weekday);
test.assertDeepEqual(offered(new Date(2026, 10, 15, 9)), ["Tuesday", "Friday"], "on Sunday offers every day with food");
test.assertDeepEqual(offered(new Date(2026, 10, 17, 10, 59)), ["Tuesday", "Friday"], "offers today before the reminder time");
test.assertDeepEqual(offered(new Date(2026, 10, 17, 11, 0)), ["Friday"], "drops today once the reminder time has come");
test.assertDeepEqual(offered(new Date(2026, 10, 21)), [], "offers nothing after the week");
test.assertEqual(LunchReminders.thingsWhen(new Date(2026, 10, 3), "11:00"), "2026-11-03@11:00", "builds Things' when with the reminder");

// --- create() ---
test.section("create()");

const settings = loadRepoYAML("nr-settings.yaml").lunchReminders;
const sent = [];
/** @type {any} */ (globalThis).TJSTodo = { create: () => ({}) };
ThingsParser.prototype.send = (items) => sent.push(...items) > 0;

function makeUI(chosen, shown = true) {
  const ui = { messages: [], menus: [] };
  ui.buildMenu = (built) => {
    ui.menus.push(built);
    return { show: () => shown, fieldValues: { days: chosen } };
  };
  ui.displayAppMessage = (type, message) => ui.messages.push({ type, message });
  ui.displaySuccessMessage = (message) => ui.messages.push({ type: "success", message });
  ui.displayErrorMessage = (message) => {
    ui.messages.push({ type: "error", message });
    return false;
  };
  return ui;
}

const sunday = new Date(2026, 10, 15, 9);
const ui = makeUI(["Friday: Pork Carnitas"]);
new LunchReminders(settings, ui, { content: menu }).create(sunday);
test.assertDeepEqual(ui.menus[0].menuItems[0].data.values, ["Tuesday: Roasted Chicken Wings", "Friday: Pork Carnitas"], "lists each offered day with its first item");
test.assertEqual(sent.length, 1, "sends only the picked day");
test.assertEqual(sent[0].title, "Pack containers to bring home food", "uses the task title from settings");
test.assertEqual(sent[0].when, "2026-11-20@11:00", "schedules it for the day with an 11:00 reminder");
test.assertEqual(sent[0].notes, days[2].notes, "puts the day's menu in the notes");
test.assertEqual(sent[0].list, settings.area, "files it in the area from settings");
test.assertEqual(ui.messages[0].message, "Added 1 lunch reminders to Things.", "reports how many were added");

const lateUI = makeUI([]);
new LunchReminders(settings, lateUI, { content: menu }).create(new Date(2026, 10, 21));
test.assertEqual(lateUI.menus.length, 0, "does not show the picker when no days are left");
test.assertEqual(lateUI.messages[0].message, settings.messages.noDays, "says no days are left");

test.summary();
