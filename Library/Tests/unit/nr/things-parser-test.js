/**
 * Things Parser Unit Tests
 *
 * Covers MustachePrompt with a stub UI and a stub MustacheTemplate that records
 * what it was asked to render, and ThingsParser with the real Birch Outline and
 * plain-object stand-ins for the TJS classes.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/MustachePrompt.js");
require("modules/nr/ThingsParser.js");

const test = new TestAssertions("Things Parser");

// --- Drafts stand-ins ---

const pad = (n) => String(n).padStart(2, "0");
/** @type {any} */ (globalThis).strftime = (date, format) =>
  format.replace("%Y", date.getFullYear()).replace("%m", pad(date.getMonth() + 1)).replace("%d", pad(date.getDate()));

/** @type {any} */
let rendered;
/** @type {any} */ (globalThis).MustacheTemplate = {
  createWithTemplate: (template) => ({
    render(data) {
      rendered = { template, data, contentType: this.contentType };
      return "rendered";
    },
  }),
};

// Each TJS stand-in is a plain object, with add* methods filling arrays.
const thing = (kind, lists = {}) => ({
  create: () => {
    const item = { kind };
    for (const [method, field] of Object.entries(lists)) {
      item[field] = [];
      item[method] = (child) => item[field].push(child);
    }
    return item;
  },
});
/** @type {any} */ (globalThis).TJSProject = thing("project", { addTodo: "todos", addHeading: "headings" });
/** @type {any} */ (globalThis).TJSTodo = thing("todo", { addChecklistItem: "checklist" });
/** @type {any} */ (globalThis).TJSHeading = thing("heading");
/** @type {any} */ (globalThis).TJSChecklistItem = thing("checklistItem");

// The prompt answers with fieldValues, or is cancelled when shown is false.
function makeUI({ shown = true, fieldValues = {} } = {}) {
  const ui = { menus: [] };
  ui.buildMenu = (menu) => {
    ui.menus.push(menu);
    return { show: () => shown, fieldValues };
  };
  return ui;
}

const fieldsOf = (ui) => ui.menus[0].menuItems.filter((item) => item.type != "button");

// --- finding variables ---
test.section("finding variables");

let variables = MustachePrompt.findVariables("{{name}} {{date:due}} {{due+1d}} {{bool:#urgent}}{{/urgent}} {{^none}}x{{/none}}");
test.assertDeepEqual([...variables.keys()], ["name", "due", "urgent", "none"], "finds each variable once, in order");
test.assertEqual(variables.get("due").type, "date", "a type on any tag sets the variable's type");
test.assertEqual(variables.get("due").tags.length, 2, "keeps every tag of a variable");
test.assertEqual(variables.get("urgent").isSection, true, "marks {{#name}} as a section");
test.assertEqual(variables.get("none").isSection, false, "finds inverted sections without marking them as sections");

// --- rewriting tags ---
test.section("rewriting tags");

const tagged = "{{date:due}} / {{date:due-1d}} / {{due+2w}} / {{date:due}}";
test.assertEqual(
  MustachePrompt.plainTags(tagged, MustachePrompt.findVariables(tagged)),
  "{{due}} / {{due_offset_backwards_1d}} / {{due_offset_forward_2w}} / {{due}}",
  "drops type prefixes and names offset tags after their offset"
);

// --- date offsets ---
test.section("date offsets");

const ymd = (date) => strftime(date, "%Y-%m-%d");
const start = new Date(2026, 0, 31);
test.assertEqual(ymd(MustachePrompt.offsetDate(start, "+1d")), "2026-02-01", "adds days");
test.assertEqual(ymd(MustachePrompt.offsetDate(start, "-2w")), "2026-01-17", "subtracts weeks");
test.assertEqual(ymd(MustachePrompt.offsetDate(start, "+1m")), "2026-02-28", "uses the last day of a shorter month");
test.assertEqual(ymd(start), "2026-01-31", "leaves the original date alone");

// --- rendering ---
test.section("rendering");

let ui = makeUI();
test.assertEqual(new MustachePrompt(ui).render("- plain task {{ }}"), "- plain task {{ }}", "returns text with no variables unchanged");
test.assertEqual(ui.menus.length, 0, "asks nothing when there are no variables");

ui = makeUI({ shown: false });
test.assertEqual(new MustachePrompt(ui).render("{{name}}"), null, "returns null when the prompt is cancelled");

ui = makeUI({ fieldValues: { trip: "Paris", due: new Date(2026, 10, 10), items: "socks, shirts", urgent: true } });
let result = new MustachePrompt(ui).render("{{trip}} {{date:due}} {{due-1d}} {{#items}}{{.}}{{/items}} {{bool:#urgent}}!{{/urgent}}");
test.assertEqual(result, "rendered", "returns the rendered text");
test.assertDeepEqual(
  fieldsOf(ui).map((item) => item.type),
  ["textField", "datePicker", "textField", "switch"],
  "builds a field for each variable's type"
);
test.assertEqual(rendered.template, "{{trip}} {{due}} {{due_offset_backwards_1d}} {{#items}}{{.}}{{/items}} {{#urgent}}!{{/urgent}}", "renders the rewritten tags");
test.assertDeepEqual(
  rendered.data,
  { trip: "Paris", due: "2026-11-10", due_offset_backwards_1d: "2026-11-09", items: ["socks", "shirts"], urgent: true },
  "formats dates, adds offset dates, and splits section lists"
);
test.assertEqual(rendered.contentType, "text", "renders as text so values are not HTML-escaped");

// --- parsing outlines ---
test.section("parsing outlines");

const outline = [
  "Trip: @area(Personal) @when(today) @tags(travel, summer)",
  "\tPack the night before",
  "\t- Book hotel @due(2026-11-01) @done",
  "\t\tAsk for a late checkout",
  "\t\t- Compare prices @cancelled",
  "",
  "\tDay of: @done",
  "\t\t- Water plants",
  "\t\tLeave a key with Sam",
  "\tCall the airline",
  "",
  "- Renew passport @list(Errands) @listid(abc123) @tag(admin)",
  "Not a task",
].join("\n");

const items = new ThingsParser().parse(outline);
test.assertDeepEqual(items.map((item) => item.kind), ["project", "todo"], "keeps top-level projects and to-dos, skips notes");

const [project, passport] = items;
test.assertEqual(project.title, "Trip", "sets the project title");
test.assertEqual(project.area, "Personal", "sets the area");
test.assertEqual(project.when, "today", "sets when");
test.assertDeepEqual(project.tags, ["travel", "summer"], "splits @tags");
test.assertEqual(project.completed, false, "leaves the project open");
test.assertEqual(project.notes, "Pack the night before\n\nLeave a key with Sam\nCall the airline", "keeps notes in order, including notes under a heading");

test.assertDeepEqual(project.headings.map((heading) => heading.title), ["Day of"], "adds headings");
test.assertDeepEqual(project.todos.map((todo) => todo.title), ["Book hotel", "Water plants"], "adds to-dos from the project and its headings");
test.assertEqual(project.todos[1].heading, "Day of", "files a heading's to-dos under it");

const hotel = project.todos[0];
test.assertEqual(hotel.deadline, "2026-11-01", "reads @due as the deadline");
test.assertEqual(hotel.completed, true, "reads @done as completed");
test.assertEqual(hotel.notes, "Ask for a late checkout", "adds the to-do's notes");
test.assertEqual(hotel.checklist[0].title, "Compare prices", "adds checklist items");
test.assertEqual(hotel.checklist[0].canceled, true, "reads @cancelled as canceled");

test.assertEqual(passport.list, "Errands", "sets the list");
test.assertEqual(passport.listID, "abc123", "reads @listid as listID");
test.assertDeepEqual(passport.tags, ["admin"], "reads a single @tag");

const [sanity] = new ThingsParser().parse(ThingsParser.fromChecklist("- [ ] Clean the gutters @area(Sanity)").todos);
test.assertEqual(sanity.list, "Sanity", "files a to-do with @area in that area, through its list");
test.assertEqual(new ThingsParser().parse("- Plan @area(Personal) @list(Move)")[0].list, "Move", "prefers @list over @area on a to-do");
test.assertEqual(passport.notes, undefined, "leaves notes unset when there are none");
test.assertEqual(project.headings[0].archived, true, "reads @done on a heading as archived");

const [spaced, chores] = new ThingsParser().parse(
  ["Spaced:", "", "\t- a", "", "", "\t- b", "", "- Chores @defer(tomorrow) @deadline(friday) @tag(home, errands)"].join("\n")
);
test.assertEqual(spaced.notes, undefined, "leaves notes unset when a project has only blank lines");
test.assertEqual(chores.when, "tomorrow", "reads @defer as when");
test.assertEqual(chores.deadline, "friday", "reads @deadline as the deadline");
test.assertDeepEqual(chores.tags, ["home", "errands"], "splits a comma list in @tag");

// --- sections after an inverted section ---
test.section("sections after an inverted section");

ui = makeUI({ fieldValues: { items: "socks, shirts" } });
new MustachePrompt(ui).render("{{^items}}none{{/items}}{{#items}}- {{.}}{{/items}}");
test.assertDeepEqual(rendered.data.items, ["socks", "shirts"], "splits the list when any tag opens a {{#section}}");

// --- checklists ---
test.section("checklists");

const page = [
  "### To-Dos",
  "",
  "- [ ] Buy milk #errands #home",
  "- [ ] ",
  "- [x] Already done",
  "  * [ ] Call Sam @when(today) #phone",
  "- Primary goal, not a checkbox",
  "- [ ] #only-a-tag",
  "Some text [ ] in a sentence",
  "## Thoughts",
].join("\n");

const checklist = ThingsParser.fromChecklist(page);
test.assertEqual(
  checklist.todos,
  "- Buy milk @tags(errands, home)\n- Call Sam @tags(phone) @when(today)",
  "turns open checkboxes into TaskPaper to-dos, in order, with #tags as @tags"
);
test.assertEqual(
  checklist.text,
  "### To-Dos\n\n- [x] Already done\n- Primary goal, not a checkbox\nSome text [ ] in a sentence\n## Thoughts",
  "removes every open checkbox line, blank ones too, and keeps the rest"
);
test.assertDeepEqual(ThingsParser.fromChecklist("No to-dos here"), { todos: "", text: "No to-dos here" }, "leaves text with no checkboxes alone");

const [milk, sam] = new ThingsParser().parse(checklist.todos);
test.assertEqual(milk.title, "Buy milk", "parses the converted to-do's title");
test.assertDeepEqual(milk.tags, ["errands", "home"], "parses the converted tags");
test.assertEqual(milk.list, undefined, "sets no list, so to-dos land in the Inbox");
test.assertEqual(sam.when, "today", "keeps @tags written on a checkbox line");
test.assertDeepEqual(new ThingsParser().parse(""), [], "parses no items from no to-dos");

const tricky = ThingsParser.fromChecklist(
  [
    "- [ ] Meet @john re: budget",
    "- [ ] Call @my-tag now",
    "- [ ] Ping @café person",
    "- [ ] Email sam@example.com",
    "- [ ] Do it @when(today) later #home",
    "- [ ] Things @tags(a, b) #c",
    "1. [ ] Numbered @done",
    "- [ ] Pay rent\r",
  ].join("\n")
);
test.assertEqual(
  tricky.todos,
  [
    "- Meet @john re: budget",
    "- Call @my-tag now",
    "- Ping @café person",
    "- Email sam@example.com",
    "- Do it later @tags(home) @when(today)",
    "- Things @tags(a, b, c)",
    "- Numbered @done",
    "- Pay rent",
  ].join("\n"),
  "moves only the @tags it reads, merges @tags with #tags, and handles numbered and CRLF lines"
);
const trickyItems = new ThingsParser().parse(tricky.todos);
test.assertEqual(trickyItems[0].title, "Meet @john re: budget", "keeps other @words in the title");
test.assertEqual(trickyItems[6].completed, true, "reads @done on a checkbox line");
test.assertEqual(tricky.text, "", "removes numbered and CRLF checkbox lines");

// --- sending ---
test.section("sending");

let callbacks = [];
let opened = true;
/** @type {any} */ (globalThis).TJSContainer = { create: (items) => ({ url: `things:///json?count=${items.length}` }) };
/** @type {any} */ (globalThis).CallbackURL = {
  create: () => {
    const callback = { parameters: {}, opened: false };
    callback.addParameter = (key, value) => (callback.parameters[key] = value);
    callback.open = () => (callback.opened = true) && opened;
    callbacks.push(callback);
    return callback;
  },
};

test.assertEqual(new ThingsParser().send([milk, sam]), true, "reports when Things added the items");
test.assertEqual(callbacks[0].baseURL, "things:///json?count=2", "sends every item in one Things link");
test.assertEqual(callbacks[0].opened, true, "waits for Things through the callback");
test.assertDeepEqual(callbacks[0].parameters, {}, "does not ask Things to reveal, so it returns to Drafts");

opened = false;
test.assertEqual(new ThingsParser().send([milk]), false, "reports when Things did not add the items");

test.summary();
