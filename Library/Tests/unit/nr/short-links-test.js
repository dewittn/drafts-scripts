/**
 * ShortLinks / LinkShortener Unit Tests
 *
 * Covers the link cache, URL matching, domains, paged sync, and the Shorten
 * Link prompt with a stub Kutt, a stub file manager, a stub UI, and the real
 * kutt settings.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/kutt.js");
require("modules/nr/ShortLinks.js");

const test = new TestAssertions("ShortLinks");

// --- stubs ---

// Kutt on lnk.test with a fixed list of links and custom domains, served in pages.
function makeKutt(serverLinks = [], { domains = [], failCreate = false, failList = false, failUser = false } = {}) {
  /** @type {any} */
  const kutt = { host: "lnk.test", created: [], pages: [] };
  kutt.createLink = (target, options = {}) => {
    kutt.created.push({ target, ...options });
    if (failCreate) return { success: false, error: "Kutt Error: 500 - Create Link Failed" };
    const host = options.domain ?? "lnk.test";
    return { id: "new", target, link: `https://${host}/${kutt.created.length}`, created_at: "2026-11-15T00:00:00Z" };
  };
  kutt.getLinks = ({ limit, skip }) => {
    kutt.pages.push(skip);
    if (failList) return { success: false, error: "Kutt Error: 401 - Get Links Failed" };
    return { total: serverLinks.length, limit, skip, data: serverLinks.slice(skip, skip + limit) };
  };
  kutt.getUserInfo = () => {
    if (failUser) return { success: false, error: "Kutt Error: 401 - Get User Info Failed" };
    return { domains };
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

// UI answering the prompt with { shown, url, domainRow }.
/** @param {{ shown: boolean, url?: string, domainRow?: number }} [reply] */
function makeUI(reply = { shown: true, url: "" }) {
  const ui = { menus: [], inserted: [], messages: [] };
  ui.settingsCopy = (name) => JSON.parse(JSON.stringify(settings[name]));
  ui.buildMenu = (menu) => {
    ui.menus.push(menu);
    const fieldValues = { url: reply.url, domain: reply.domainRow == undefined ? undefined : [reply.domainRow] };
    return { show: () => reply.shown, fieldValues };
  };
  ui.insertAtCursor = (text) => ui.inserted.push(text);
  ui.displayAppMessage = (type, message) => ui.messages.push({ type, message });
  return ui;
}

function reset(clipboard = "") {
  calls = { fail: [], cancel: 0, clipboard, set: [] };
}

const cacheFile = "/Library/Data/links.json";
const link = (n, host = "lnk.test", created_at = `2026-01-01T00:00:${String(n % 60).padStart(2, "0")}Z`) => ({
  id: `id${n}`,
  target: `https://example.com/${n}`,
  link: `https://${host}/s${n}`,
  created_at,
});
const savedFile = (links, domains = []) => ({ [cacheFile]: { domains, links } });
const menuTypes = (menu) => menu.menuItems.map((item) => item.type);

// --- URL helpers ---
test.section("URL helpers");

test.assertTruthy(LinkShortener.isURL("https://example.com/post"), "isURL accepts an https link");
test.assertTruthy(LinkShortener.isURL("  http://example.com \n"), "isURL ignores surrounding whitespace");
test.assertFalsy(LinkShortener.isURL("see https://example.com"), "isURL rejects text around a link");
test.assertFalsy(LinkShortener.isURL("example.com"), "isURL rejects a link without a scheme");
test.assertFalsy(LinkShortener.isURL(undefined), "isURL rejects nothing");

test.assertEqual(LinkShortener.normalizeURL(" https://Example.COM/Post/ "), "https://example.com/Post", "normalizeURL lowercases the host and drops the trailing slash");
test.assertEqual(LinkShortener.normalizeURL("https://example.com/"), "https://example.com", "normalizeURL drops a bare trailing slash");
test.assertEqual(LinkShortener.normalizeURL("https://example.com/a?q=B"), "https://example.com/a?q=B", "normalizeURL leaves paths and queries alone");

test.assertEqual(LinkShortener.hostOf("https://Lnk.test/abc"), "lnk.test", "hostOf gives the lowercased host");
test.assertEqual(LinkShortener.hostOf("https://lnk.test"), "lnk.test", "hostOf works without a path");

// --- shorten ---
test.section("shorten");

let kutt = makeKutt();
let files = makeFiles(savedFile([link(1)]));
let shortener = new LinkShortener(kutt, files);
test.assertEqual(shortener.shorten(" https://example.com/1 ").link, "https://lnk.test/s1", "cache hit returns the cached link");
test.assertEqual(shortener.shorten("https://example.com/1/").link, "https://lnk.test/s1", "a trailing slash still matches");
test.assertEqual(shortener.shorten("https://EXAMPLE.com/1").link, "https://lnk.test/s1", "a different-case host still matches");
test.assertEqual(kutt.created.length, 0, "cache hits make no request");

let result = shortener.shorten("https://example.com/new");
test.assertEqual(result.link, "https://lnk.test/1", "cache miss returns Kutt's link");
test.assertDeepEqual(kutt.created, [{ target: "https://example.com/new" }], "cache miss asks Kutt once, without a domain");
test.assertEqual(files.files[cacheFile].links.length, 2, "saves the new link to links.json");
test.assertEqual(shortener.shorten("https://example.com/new/").link, "https://lnk.test/1", "the new link is found next time");

kutt = makeKutt([], { failCreate: true });
files = makeFiles();
result = new LinkShortener(kutt, files).shorten("https://example.com/x");
test.assertEqual(result.success, false, "passes a Kutt failure back");
test.assertFalsy(cacheFile in files.files, "caches nothing on failure");

// --- old links.json ---
test.section("old links.json");

shortener = new LinkShortener(makeKutt(), makeFiles({ [cacheFile]: { "https://example.com/1": link(1) } }));
test.assertEqual(shortener.lookup("https://example.com/1").link, "https://lnk.test/s1", "reads the old { target: link } file");
test.assertDeepEqual(shortener.domains, ["lnk.test"], "with only the default domain");

// --- domains ---
test.section("domains");

kutt = makeKutt();
files = makeFiles(savedFile([link(1), link(2, "go.test")], ["go.test"]));
shortener = new LinkShortener(kutt, files);
test.assertDeepEqual(shortener.domains, ["lnk.test", "go.test"], "lists the default domain first, then custom ones");
test.assertEqual(shortener.shorten("https://example.com/2").link, "https://go.test/s2", "finds a custom-domain link with the default domain chosen");
test.assertEqual(shortener.shorten("https://example.com/1", "go.test").link, "https://lnk.test/s1", "finds a default-domain link with a custom domain chosen");
test.assertEqual(kutt.created.length, 0, "without asking Kutt");

result = shortener.shorten("https://example.com/new", "go.test");
test.assertEqual(result.link, "https://go.test/1", "makes a new link on the chosen domain");
test.assertDeepEqual(kutt.created, [{ target: "https://example.com/new", domain: "go.test" }], "asks Kutt for that domain");

// --- sync ---
test.section("sync");

const server = Array.from({ length: 120 }, (_, i) => link(i));
kutt = makeKutt(server, { domains: [{ address: "Go.test", banned: false }, { address: "old.test", banned: true }] });
files = makeFiles(savedFile([{ ...link(999), target: "https://gone.example" }]));
shortener = new LinkShortener(kutt, files);
result = shortener.sync();
test.assertDeepEqual(result, { success: true, count: 120 }, "counts every link");
test.assertDeepEqual(kutt.pages, [0, 50, 100], "pages through all links 50 at a time");
test.assertEqual(files.files[cacheFile].links.length, 120, "writes every link to links.json");
test.assertEqual(shortener.lookup("https://gone.example"), undefined, "drops links no longer on Kutt");
test.assertDeepEqual(files.files[cacheFile].domains, ["go.test"], "saves custom domains, lowercased, without banned ones");

kutt = makeKutt(server.slice(0, 50));
new LinkShortener(kutt, makeFiles()).sync();
test.assertDeepEqual(kutt.pages, [0], "stops after a full last page that reaches the total");

const original = { ...link(1), link: "https://lnk.test/orig", created_at: "2026-01-01T00:00:00Z" };
const duplicate = { ...link(1), target: "https://example.com/1/", link: "https://lnk.test/dupe", created_at: "2026-11-15T00:00:00Z" };
shortener = new LinkShortener(makeKutt([duplicate, original]), makeFiles());
shortener.sync();
test.assertEqual(shortener.lookup("https://example.com/1").link, "https://lnk.test/orig", "keeps the older of two links for the same page");

kutt = makeKutt([], { failList: true });
files = makeFiles(savedFile([link(1)]));
result = new LinkShortener(kutt, files).sync();
test.assertEqual(result.success, false, "reports a failed sync");
test.assertEqual(result.error, "Kutt Error: 401 - Get Links Failed", "with Kutt's error");
test.assertEqual(files.files[cacheFile].links.length, 1, "keeps the old cache on failure");

result = new LinkShortener(makeKutt(server, { failUser: true }), makeFiles()).sync();
test.assertEqual(result.error, "Kutt Error: 401 - Get User Info Failed", "fails when the domains cannot be read");

// --- Shorten Link prompt ---
test.section("Shorten Link prompt");

reset("https://example.com/1\n");
let ui = makeUI({ shown: true, url: "https://example.com/1" });
let links = new ShortLinks(settings, ui, new LinkShortener(makeKutt(), makeFiles(savedFile([link(1)]))));
test.assertEqual(links.shortenPrompted(), "https://lnk.test/s1", "returns the short link");
test.assertEqual(ui.menus[0].menuItems[0].data.initialText, "https://example.com/1", "starts with the clipboard link");
test.assertDeepEqual(menuTypes(ui.menus[0]), ["textField", "button"], "leaves out the domain menu with one domain");
test.assertDeepEqual(ui.inserted, ["https://lnk.test/s1"], "inserts the short link at the cursor");
test.assertDeepEqual(calls.set, ["https://lnk.test/s1"], "copies the short link");
test.assertDeepEqual(ui.messages, [{ type: "success", message: "Copied https://lnk.test/s1" }], "says it was copied");

reset();
kutt = makeKutt();
ui = makeUI({ shown: true, url: "https://example.com/new", domainRow: 1 });
links = new ShortLinks(settings, ui, new LinkShortener(kutt, makeFiles(savedFile([], ["go.test"]))));
test.assertEqual(links.shortenPrompted(), "https://go.test/1", "makes a new link on the domain picked");
test.assertDeepEqual(kutt.created, [{ target: "https://example.com/new", domain: "go.test" }], "asks Kutt for the picked domain");
const domainMenu = ui.menus[0].menuItems.find((item) => item.data.name == "domain");
test.assertEqual(domainMenu.type, "picker", "shows the domains in a picker");
test.assertDeepEqual(domainMenu.data.columns, [["lnk.test", "go.test"]], "offers every domain");
test.assertDeepEqual(domainMenu.data.selectedRows, [0], "with the default domain chosen");

reset();
ui = makeUI({ shown: true, url: "https://example.com/2" });
links = new ShortLinks(settings, ui, new LinkShortener(makeKutt(), makeFiles(savedFile([link(2, "go.test")], ["go.test"]))));
test.assertEqual(links.shortenPrompted(), "https://go.test/s2", "returns an existing link whatever domain is picked");

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
