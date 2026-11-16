/**
 * WhatsForLunch Unit Tests
 *
 * Covers which days show a dialog, which say there is no lunch, and which
 * open the menu instead, with a mock UI and a stubbed editor.
 */

require("../Tests/fixtures/assertions.js");
require("modules/nr/WhatsForLunch.js");

const test = new TestAssertions("WhatsForLunch");

const menuDraft = {
  content: `# Lunch Menu: Nov 16 to Nov 20, 2026

----
## Monday, November 16

----
## Tuesday, November 17
**Main Entree**
- Roasted Chicken Wings

**Sides**
- Steamed Rice`,
};

const loaded = [];
/** @type {any} */ (globalThis).editor = { load: (opened) => loaded.push(opened) };

const settings = loadRepoYAML("nr-settings.yaml").whatsForLunch;

function makeUI(button = "ok") {
  const ui = { messages: [], dialogs: [] };
  ui.buildMenu = (built) => {
    ui.dialogs.push(built);
    return { show: () => true, buttonPressed: button };
  };
  ui.displayAppMessage = (type, message) => ui.messages.push({ type, message });
  ui.displayErrorMessage = (message) => ui.messages.push({ type: "error", message });
  return ui;
}

function run(now, button) {
  loaded.length = 0;
  const ui = makeUI(button);
  new WhatsForLunch(settings, ui, menuDraft).show(now);
  return ui;
}

// --- settings ---
test.section("settings");

test.assertEqual(settings.menuTag, "bvr/menu", "shares the menu tag with Lunch Reminders");

// --- show() ---
test.section("show()");

const tuesday = run(new Date(2026, 10, 17, 8));
test.assertEqual(tuesday.dialogs[0].menuTitle, "Tuesday's Lunch", "titles the dialog with the weekday");
test.assertEqual(tuesday.dialogs[0].menuMessage, "Main Entree\n- Roasted Chicken Wings\n\nSides\n- Steamed Rice", "shows the day's menu without bold markers");
test.assertEqual(loaded.length, 0, "stays put when OK is tapped");

run(new Date(2026, 10, 17, 8), "open");
test.assertEqual(loaded[0], menuDraft, "opens the menu from the dialog's Open Menu button");

const monday = run(new Date(2026, 10, 16, 8));
test.assertEqual(monday.dialogs.length, 0, "shows no dialog on a day with no lunch");
test.assertEqual(monday.messages[0].message, settings.messages.noLunch, "says there is no lunch today");

const saturday = run(new Date(2026, 10, 21, 8));
test.assertEqual(saturday.dialogs.length, 0, "shows no dialog on a weekend");
test.assertEqual(loaded[0], menuDraft, "opens the menu on a weekend");

run(new Date(2026, 10, 24, 8));
test.assertEqual(loaded[0], menuDraft, "opens the menu on a weekday it does not cover");

test.summary();
