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

// --- note lines ---
test.section("note lines");

test.assertEqual(ThingsTags.noteBreak("- Buy milk @when(today)"), "\n\t", "indents a note one tab under a to-do");
test.assertEqual(ThingsTags.noteBreak("\t- Book movers"), "\n\t\t", "indents under a nested to-do");
test.assertEqual(ThingsTags.noteBreak("Move house: @area(Personal)"), "\n\t", "indents under a project");
test.assertEqual(ThingsTags.noteBreak("\tGet the oat milk"), "\n\t", "keeps a second note level with the first");
test.assertEqual(ThingsTags.noteBreak("* Starred to-do"), "\n\t", "indents under a \"* \" to-do");

// --- read back by ThingsParser ---
test.section("read back by ThingsParser");

const line = `- Call the vet ${ThingsTags.when(picked, true)} ${ThingsTags.area("Sanity")}`;
const [todo] = new ThingsParser().parse(line);
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

// --- projects ---
test.section("projects");

// Stubbed before the require so ThingsProjects skips loading vendor/nr.js.
let opened = [];
/** @type {any} */ (globalThis).openCallback = () => undefined;
require("modules/nr/ThingsProjects.js");
const output = JSON.stringify({
  projects: [
    { title: "Fall House Cleaning", id: "Qq41J9CzFMHUku8QhLRYKV" },
    { title: "WFID Manuscript Review", id: "Qv4fGW9Y5kqiHS8AMuU8f9" },
    { title: "WFID Fall 2026 Querying", id: "JjENSUpvmYYahyr34xdEfJ" },
    { title: "End of Season Items", id: "8UqCq3XpHvX6T5nq7zwoQ3" },
    { title: "Finishing Funds", id: "JpFc5ePxJgMnG7ojZ2LNyP" },
    { title: "LLC Taxes", id: "KbtAg1eFRC1ysc2F9adbee" },
  ],
});

const projects = ThingsProjects.parse(output);
test.assertEqual(projects.length, 6, "reads every project from the shortcut's output");
test.assertEqual(ThingsTags.project(projects[5], projects), "@project(LLC Taxes)", "tags a project by its title");
test.assertEqual(ThingsProjects.parse("not json"), null, "returns null for output that is not JSON");
test.assertEqual(ThingsProjects.parse(undefined), null, "returns null when the shortcut returned nothing");
test.assertEqual(ThingsProjects.parse('{"projects": {"title": "x"}}'), null, "returns null when projects is not a list");
test.assertDeepEqual(ThingsProjects.parse('{"projects": [{"title": ""}, {"title": "Real", "id": "1"}]}'), [{ title: "Real", id: "1" }], "skips projects with no title");

const twins = [
  { title: "Taxes", id: "A1" },
  { title: "Taxes", id: "B2" },
  { title: "Groceries", id: "C3" },
];
test.assertDeepEqual(ThingsProjects.labels(twins), ["Taxes", "Taxes (2)", "Groceries"], "numbers repeated titles in the menu");
test.assertEqual(ThingsTags.project(twins[1], twins), "@listID(B2)", "tags by ID when two projects share a title");
test.assertEqual(ThingsTags.project(twins[2], twins), "@project(Groceries)", "tags by title when it is unique");

const [filed] = new ThingsParser().parse(`- File the receipts ${ThingsTags.project(projects[5], projects)}`);
test.assertEqual(filed.list, "LLC Taxes", "ThingsParser files the to-do in that project");
const [twin] = new ThingsParser().parse(`- Pay ${ThingsTags.project(twins[1], twins)}`);
test.assertEqual(twin.listID, "B2", "ThingsParser files a shared-title to-do by ID");

// --- running the shortcut ---
test.section("running the shortcut");

/** @type {any} */ (globalThis).openCallback = (baseURL, params, wait) => {
  opened.push({ baseURL, params, wait });
  return { result: output };
};
test.assertEqual(ThingsProjects.fetch("Get Things Projects").length, 6, "returns the projects the shortcut outputs");
test.assertDeepEqual(
  opened[0],
  { baseURL: "shortcuts://x-callback-url/run-shortcut", params: { name: "Get Things Projects" }, wait: true },
  "runs the named shortcut and waits for it"
);
/** @type {any} */ (globalThis).openCallback = () => undefined;
test.assertEqual(ThingsProjects.fetch("Get Things Projects"), null, "returns null when the shortcut fails");

const settings = loadRepoYAML("nr-settings.yaml").things;
test.assertEqual(settings.projectsShortcut, "Get Things Projects", "names the shortcut in settings");

test.summary();
