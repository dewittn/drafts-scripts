/**
 * ShortLinks / LinkShortener Unit Tests
 *
 * Covers the link cache, paged sync, and the Shorten Link prompt with a stub
 * Kutt, a stub file manager, a stub UI, and the real kutt settings.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/kutt.js");
require("modules/nr/ShortLinks.js");

const test = new TestAssertions("ShortLinks");

// --- stubs ---

// Kutt with a fixed list of links on the server, served in pages.
function makeKutt(serverLinks = [], { failCreate = false, failList = false } = {}) {
  /** @type {any} */
  const kutt = { created: [], pages: [] };
  kutt.createLink = (target) => {
    kutt.created.push(target);
    if (failCreate) return { success: false, error: "Kutt Error: 500 - Create Link Failed" };
    return { id: "new", target, link: `https://lnk.test/${kutt.created.length}` };
  };
  kutt.getLinks = ({ limit, skip }) => {
    kutt.pages.push(skip);
    if (failList) return { success: false, error: "Kutt Error: 401 - Get Links Failed" };
    return { total: serverLinks.length, limit, skip, data: serverLinks.slice(skip, skip + limit) };
  };
  kutt.getAllLinks = Kutt.prototype.getAllLinks.bind(kutt);
  return kutt;
}

// FileManager holding files in memory.
/** @returns {any} */
function makeFiles(files = {}) {
  return {
    files,
    exists: (path) => path in files,
    readJSON: (path) => files[path],
    writeJSON: (path, data) => {
      files[path] = data;
      return true;
    },
  };
}

let calls = { fail: [], cancel: 0, clipboard: "", set: [] };
/** @type {any} */ (globalThis).context = {
  fail: (message) => calls.fail.push(message),
  cancel: () => calls.cancel++,
};
/** @type {any} */ (globalThis).app = {
  getClipboard: () => calls.clipboard,
  setClipboard: (text) => calls.set.push(text),
};

const settings = loadRepoYAML("nr-settings.yaml").kutt;

// UI answering the prompt with { shown, url }.
/** @param {{ shown: boolean, url?: string }} [reply] */
function makeUI(reply = { shown: true, url: "" }) {
  const ui = { menus: [], inserted: [], messages: [] };
  ui.settingsCopy = (name) => JSON.parse(JSON.stringify(settings[name]));
  ui.buildMenu = (menu) => {
    ui.menus.push(menu);
    return { show: () => reply.shown, fieldValues: { url: reply.url } };
  };
  ui.insertAtCursor = (text) => ui.inserted.push(text);
  ui.displayAppMessage = (type, message) => ui.messages.push({ type, message });
  return ui;
}

function reset(clipboard = "") {
  calls = { fail: [], cancel: 0, clipboard, set: [] };
}

const cacheFile = "/Library/Data/links.json";
const link = (n) => ({ id: `id${n}`, target: `https://example.com/${n}`, link: `https://lnk.test/s${n}` });

// --- isURL ---
test.section("isURL");

test.assertTruthy(LinkShortener.isURL("https://example.com/post"), "accepts an https link");
test.assertTruthy(LinkShortener.isURL("  http://example.com \n"), "ignores surrounding whitespace");
test.assertFalsy(LinkShortener.isURL("see https://example.com"), "rejects text around a link");
test.assertFalsy(LinkShortener.isURL("example.com"), "rejects a link without a scheme");
test.assertFalsy(LinkShortener.isURL(undefined), "rejects nothing");

// --- shorten ---
test.section("shorten");

let kutt = makeKutt();
let files = makeFiles({ [cacheFile]: { "https://example.com/1": link(1) } });
let shortener = new LinkShortener(kutt, files);
test.assertEqual(shortener.shorten(" https://example.com/1 ").link, "https://lnk.test/s1", "cache hit returns the cached link");
test.assertEqual(kutt.created.length, 0, "cache hit makes no request");

let result = shortener.shorten("https://example.com/new");
test.assertEqual(result.link, "https://lnk.test/1", "cache miss returns Kutt's link");
test.assertDeepEqual(kutt.created, ["https://example.com/new"], "cache miss asks Kutt once");
test.assertEqual(files.files[cacheFile]["https://example.com/new"].link, "https://lnk.test/1", "saves the new link to links.json");

kutt = makeKutt([], { failCreate: true });
files = makeFiles();
result = new LinkShortener(kutt, files).shorten("https://example.com/x");
test.assertEqual(result.success, false, "passes a Kutt failure back");
test.assertFalsy(cacheFile in files.files, "caches nothing on failure");

// --- sync ---
test.section("sync");

const server = Array.from({ length: 120 }, (_, i) => link(i));
kutt = makeKutt(server);
files = makeFiles({ [cacheFile]: { "https://gone.example": link(999) } });
result = new LinkShortener(kutt, files).sync();
test.assertDeepEqual(result, { success: true, count: 120 }, "counts every link");
test.assertDeepEqual(kutt.pages, [0, 50, 100], "pages through all links 50 at a time");
test.assertEqual(Object.keys(files.files[cacheFile]).length, 120, "writes every link to links.json");
test.assertFalsy("https://gone.example" in files.files[cacheFile], "drops links no longer on Kutt");

kutt = makeKutt(server.slice(0, 50));
new LinkShortener(kutt, makeFiles()).sync();
test.assertDeepEqual(kutt.pages, [0], "stops after a full last page that reaches the total");

kutt = makeKutt([], { failList: true });
files = makeFiles({ [cacheFile]: { "https://example.com/1": link(1) } });
result = new LinkShortener(kutt, files).sync();
test.assertEqual(result.success, false, "reports a failed sync");
test.assertEqual(result.error, "Kutt Error: 401 - Get Links Failed", "with Kutt's error");
test.assertTruthy("https://example.com/1" in files.files[cacheFile], "keeps the old cache on failure");

// --- Shorten Link prompt ---
test.section("Shorten Link prompt");

reset("https://example.com/1\n");
let ui = makeUI({ shown: true, url: "https://example.com/1" });
let links = new ShortLinks(settings, ui, new LinkShortener(makeKutt(), makeFiles({ [cacheFile]: { "https://example.com/1": link(1) } })));
test.assertEqual(links.shortenPrompted(), "https://lnk.test/s1", "returns the short link");
test.assertEqual(ui.menus[0].menuItems[0].data.initialText, "https://example.com/1", "starts with the clipboard link");
test.assertDeepEqual(ui.inserted, ["https://lnk.test/s1"], "inserts the short link at the cursor");
test.assertDeepEqual(calls.set, ["https://lnk.test/s1"], "copies the short link");
test.assertDeepEqual(ui.messages, [{ type: "success", message: "Copied https://lnk.test/s1" }], "says it was copied");

reset("not a link");
ui = makeUI({ shown: true, url: "https://example.com/1" });
new ShortLinks(settings, ui, new LinkShortener(makeKutt(), makeFiles())).shortenPrompted();
test.assertEqual(ui.menus[0].menuItems[0].data.initialText, undefined, "leaves the field empty when the clipboard is not a link");

reset();
ui = makeUI({ shown: false });
test.assertEqual(new ShortLinks(settings, ui, new LinkShortener(makeKutt(), makeFiles())).shortenPrompted(), false, "returns false when cancelled");
test.assertEqual(calls.cancel, 1, "cancels the action");
test.assertDeepEqual(ui.inserted, [], "inserts nothing when cancelled");

reset();
ui = makeUI({ shown: true, url: "hello" });
kutt = makeKutt();
new ShortLinks(settings, ui, new LinkShortener(kutt, makeFiles())).shortenPrompted();
test.assertDeepEqual(calls.fail, ['"hello" is not a link.'], "fails on text that is not a link");
test.assertEqual(kutt.created.length, 0, "without asking Kutt");

reset();
ui = makeUI({ shown: true, url: "https://example.com/x" });
new ShortLinks(settings, ui, new LinkShortener(makeKutt([], { failCreate: true }), makeFiles())).shortenPrompted();
test.assertDeepEqual(calls.fail, ["Kutt Error: 500 - Create Link Failed"], "fails with Kutt's error");
test.assertDeepEqual(ui.inserted, [], "inserts nothing on failure");

// --- Sync Kutt Links ---
test.section("Sync Kutt Links");

reset();
ui = makeUI();
test.assertEqual(new ShortLinks(settings, ui, new LinkShortener(makeKutt(server), makeFiles())).sync(), 120, "returns the count");
test.assertDeepEqual(ui.messages, [{ type: "success", message: "Synced 120 links from Kutt." }], "reports the count");

reset();
ui = makeUI();
new ShortLinks(settings, ui, new LinkShortener(makeKutt([], { failList: true }), makeFiles())).sync();
test.assertDeepEqual(calls.fail, ["Kutt Error: 401 - Get Links Failed"], "fails with Kutt's error");

test.summary();
