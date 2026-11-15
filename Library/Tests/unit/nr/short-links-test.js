/**
 * Kutt / LinkShortener / ShortLinks Unit Tests
 *
 * Covers Kutt's requests and errors with stub HTTP and Credential objects,
 * then the link cache, URL matching, domains, syncing, and the Shorten Link
 * prompt with a stub Kutt, a stub file manager, a stub UI, and the real kutt
 * settings.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/kutt.js");
require("modules/nr/ShortLinks.js");

const test = new TestAssertions("ShortLinks");

// --- Drafts globals ---

let credentialValues = { domain: "https://lnk.test", api_key: "key123" };
/** @type {any} */ (globalThis).Credential = {
  create: () => ({
    addTextField() {},
    addPasswordField() {},
    authorize() {},
    getValue: (name) => credentialValues[name],
  }),
};

// Each request is recorded; replies are taken from the queue in order.
let http = { requests: [], replies: [] };
/** @type {any} */ (globalThis).HTTP = {
  create: () => ({
    request: (request) => {
      http.requests.push(request);
      return http.replies.shift() ?? { success: true, statusCode: 200, responseText: "{}" };
    },
  }),
};
const reply = (statusCode, body, extra = {}) => ({
  success: statusCode < 400,
  statusCode,
  responseText: typeof body == "string" ? body : JSON.stringify(body),
  ...extra,
});

let calls = { fail: [], cancel: 0, clipboard: "", set: [] };
/** @type {any} */ (globalThis).context = {
  fail: (message) => calls.fail.push(message),
  cancel: () => calls.cancel++,
};
/** @type {any} */ (globalThis).app = {
  getClipboard: () => calls.clipboard,
  setClipboard: (text) => calls.set.push(text),
};

// --- stubs ---

// Kutt on lnk.test with a fixed list of links (newest first) and custom
// domains, served in pages.
function makeKutt(serverLinks = [], { domains = [], failCreate = false, failList = false, failUser = false } = {}) {
  /** @type {any} */
  const kutt = { host: "lnk.test", created: [], pages: [], userCalls: 0 };
  kutt.createLink = (target, options = {}) => {
    kutt.created.push({ target, ...options });
    if (failCreate) return { success: false, error: "Kutt Error: 400 - Create Link Failed: URL is not valid." };
    const host = options.domain ?? "lnk.test";
    return { id: "new", target, link: `https://${host}/${kutt.created.length}`, created_at: "2026-11-15T00:00:00Z" };
  };
  kutt.getLinks = ({ limit = 50, skip = 0 } = {}) => {
    kutt.pages.push(skip);
    if (failList) return { success: false, error: "Kutt Error: 401 - Get Links Failed: API key is not correct." };
    return { total: serverLinks.length, limit, skip, data: serverLinks.slice(skip, skip + limit) };
  };
  kutt.getUserInfo = () => {
    kutt.userCalls++;
    if (failUser) return { success: false, error: "Kutt Error: 401 - Get User Info Failed" };
    return { domains };
  };
  kutt.getAllLinks = Kutt.prototype.getAllLinks.bind(kutt);
  return kutt;
}

// FileManager holding files in memory. writeJSON fails when told to.
/** @returns {any} */
function makeFiles(files = {}, { failWrite = false } = {}) {
  return {
    files,
    exists: (path) => path in files,
    readJSON: (path) => files[path],
    writeJSON: (path, data) => {
      if (failWrite) return false;
      files[path] = data;
      return true;
    },
  };
}

const settings = loadRepoYAML("nr-settings.yaml").kutt;

// UI answering the prompt with { shown, url, domainRow }.
/** @param {{ shown: boolean, url?: string, domainRow?: number }} [reply] */
function makeUI(reply = { shown: true, url: "" }) {
  const ui = { menus: [], inserted: [], messages: [] };
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

const cacheFile = LinkShortener.cacheFile;
const recently = new Date().toISOString();
const link = (n, host = "lnk.test", created_at = `2026-01-01T00:00:${String(n % 60).padStart(2, "0")}Z`) => ({
  id: `id${n}`,
  target: `https://example.com/${n}`,
  link: `https://${host}/s${n}`,
  created_at,
});
const savedFile = (links, domains = [], syncedAt = recently) => ({ [cacheFile]: { syncedAt, domains, links } });
const menuTypes = (menu) => menu.menuItems.map((item) => item.type);

// --- Kutt requests ---
test.section("Kutt requests");

http = { requests: [], replies: [reply(200, { id: "a", link: "https://lnk.test/a" })] };
let kuttClient = new Kutt();
kuttClient.createLink("https://example.com/post");
let request = http.requests[0];
test.assertEqual(request.url, "https://lnk.test/api/v2/links", "posts to the links endpoint");
test.assertEqual(request.method, "POST", "with POST");
test.assertEqual(request.headers["X-API-Key"], "key123", "sends the API key");
test.assertEqual(request.encoding, "json", "as JSON");
test.assertDeepEqual(request.data, { target: "https://example.com/post", reuse: true }, "asks Kutt to reuse an existing link, with no domain");

http = { requests: [], replies: [] };
kuttClient.createLink("https://example.com/post", { domain: "go.test" });
test.assertEqual(http.requests[0].data.domain, "go.test", "sends a custom domain when given");

http = { requests: [], replies: [reply(200, { total: 0, data: [] })] };
kuttClient.getLinks();
test.assertEqual(http.requests[0].url, "https://lnk.test/api/v2/links?limit=50&skip=0", "lists the newest 50 links");
test.assertEqual(http.requests[0].data, undefined, "with no body");

http = { requests: [], replies: [reply(200, { total: 120, data: Array(50).fill(link(1)) }), reply(200, { total: 120, data: [] })] };
let all = kuttClient.getAllLinks();
test.assertEqual(http.requests.length, 2, "stops paging when a page comes back empty");
test.assertEqual(all.data.length, 50, "with the links fetched so far");

credentialValues = { domain: " lnk.test/ ", api_key: "key123" };
test.assertEqual(new Kutt().host, "lnk.test", "takes a Kutt address without a scheme");
http = { requests: [], replies: [] };
new Kutt().getUserInfo();
test.assertEqual(http.requests[0].url, "https://lnk.test/api/v2/users", "and adds https:// to it");

credentialValues = { domain: "", api_key: "key123" };
test.assertThrows(() => new Kutt(), "throws when no Kutt address is saved");
credentialValues = { domain: "https://lnk.test", api_key: "key123" };

// --- Kutt errors ---
test.section("Kutt errors");

http = { requests: [], replies: [reply(400, { error: "URL is not valid." })] };
let result = new Kutt().createLink("nope");
test.assertEqual(result.success, false, "returns a failure");
test.assertEqual(result.error, "Kutt Error: 400 - Create Link Failed: URL is not valid.", "with Kutt's reason");

http = { requests: [], replies: [{ success: false, statusCode: 0, responseText: "", error: "The Internet connection appears to be offline." }] };
result = new Kutt().getLinks();
test.assertEqual(result.error, "Kutt Error: 0 - Get Links Failed: The Internet connection appears to be offline.", "with the network reason when Kutt was not reached");

http = { requests: [], replies: [reply(200, "<html>Login</html>")] };
result = new Kutt().getLinks();
test.assertEqual(result.error, "Kutt Error: 200 - Get Links Failed: reply is not JSON", "fails on a reply that is not JSON");

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

test.assertEqual(Kutt.hostOf("https://Lnk.test/abc"), "lnk.test", "hostOf gives the lowercased host");
test.assertEqual(Kutt.hostOf("https://lnk.test"), "lnk.test", "hostOf works without a path");

let shortener = new LinkShortener(makeKutt(), makeFiles(savedFile([], ["go.test"])));
test.assertTruthy(shortener.isShortLink("https://lnk.test/abc"), "isShortLink knows the default domain");
test.assertTruthy(shortener.isShortLink("https://GO.test/abc"), "and custom domains");
test.assertFalsy(shortener.isShortLink("https://example.com/abc"), "but not other sites");

// --- shorten ---
test.section("shorten");

let kutt = makeKutt();
let files = makeFiles(savedFile([link(1)]));
shortener = new LinkShortener(kutt, files);
test.assertEqual(shortener.shorten(" https://example.com/1 ").link, "https://lnk.test/s1", "cache hit returns the cached link");
test.assertEqual(shortener.shorten("https://example.com/1/").link, "https://lnk.test/s1", "a trailing slash still matches");
test.assertEqual(shortener.shorten("https://EXAMPLE.com/1").link, "https://lnk.test/s1", "a different-case host still matches");
test.assertEqual(kutt.pages.length + kutt.created.length, 0, "cache hits make no request");

result = shortener.shorten("https://example.com/new");
test.assertEqual(result.link, "https://lnk.test/1", "cache miss returns Kutt's link");
test.assertDeepEqual(kutt.pages, [0], "after checking Kutt's newest links");
test.assertDeepEqual(kutt.created, [{ target: "https://example.com/new" }], "then asks Kutt to make it, without a domain");
test.assertEqual(files.files[cacheFile].links.length, 2, "saves the new link to links.json");
test.assertEqual(shortener.shorten("https://example.com/new/").link, "https://lnk.test/1", "the new link is found next time");

const madeByWebsite = { ...link(7), target: "https://example.com/7/", created_at: "2026-11-14T00:00:00Z" };
kutt = makeKutt([madeByWebsite]);
files = makeFiles(savedFile([link(1)]));
shortener = new LinkShortener(kutt, files);
test.assertEqual(shortener.shorten("https://example.com/7").link, "https://lnk.test/s7", "finds a link made outside Drafts since the last sync");
test.assertEqual(kutt.created.length, 0, "without making a new one");
test.assertEqual(files.files[cacheFile].links.length, 2, "and caches it");

kutt = makeKutt([], { failCreate: true });
files = makeFiles();
result = new LinkShortener(kutt, files).shorten("https://example.com/x");
test.assertEqual(result.success, false, "passes a Kutt failure back");
test.assertFalsy(cacheFile in files.files, "caches nothing on failure");

shortener = new LinkShortener(makeKutt(), makeFiles({ [cacheFile]: { "https://example.com/1": link(1) } }));
test.assertEqual(shortener.links.length, 0, "ignores a links.json in an unknown shape");

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
const syncTime = new Date("2026-11-15T12:00:00Z");
kutt = makeKutt(server, { domains: [{ address: "Go.test", banned: false }, { address: "old.test", banned: true }] });
files = makeFiles(savedFile([{ ...link(999), target: "https://gone.example" }]));
shortener = new LinkShortener(kutt, files);
result = shortener.sync(syncTime);
test.assertDeepEqual(result, { success: true, count: 120 }, "counts every link");
test.assertDeepEqual(kutt.pages, [0, 50, 100], "pages through all links 50 at a time");
test.assertEqual(files.files[cacheFile].links.length, 120, "writes every link to links.json");
test.assertEqual(shortener.lookup("https://gone.example"), undefined, "drops links no longer on Kutt");
test.assertDeepEqual(files.files[cacheFile].domains, ["go.test"], "saves custom domains, lowercased, without banned ones");
test.assertEqual(files.files[cacheFile].syncedAt, "2026-11-15T12:00:00.000Z", "records when it synced");

kutt = makeKutt(server.slice(0, 50));
new LinkShortener(kutt, makeFiles()).sync();
test.assertDeepEqual(kutt.pages, [0], "stops after a full last page that reaches the total");

const original = { ...link(1), link: "https://lnk.test/orig", created_at: "2026-01-01T00:00:00Z" };
const duplicate = { ...link(1), target: "https://example.com/1/", link: "https://lnk.test/dupe", created_at: "2026-11-15T00:00:00Z" };
shortener = new LinkShortener(makeKutt([duplicate, original]), makeFiles());
test.assertDeepEqual(shortener.sync(), { success: true, count: 1 }, "counts pages, not duplicate links");
test.assertEqual(shortener.lookup("https://example.com/1").link, "https://lnk.test/orig", "keeps the older of two links for the same page");

kutt = makeKutt([], { failList: true });
files = makeFiles(savedFile([link(1)]));
result = new LinkShortener(kutt, files).sync();
test.assertEqual(result.success, false, "reports a failed sync");
test.assertEqual(result.error, "Kutt Error: 401 - Get Links Failed: API key is not correct.", "with Kutt's error");
test.assertEqual(files.files[cacheFile].links.length, 1, "keeps the old cache on failure");

result = new LinkShortener(makeKutt(server, { failUser: true }), makeFiles()).sync();
test.assertEqual(result.error, "Kutt Error: 401 - Get User Info Failed", "fails when the domains cannot be read");

result = new LinkShortener(makeKutt(server), makeFiles({}, { failWrite: true })).sync();
test.assertDeepEqual(result, { success: false, error: `Could not save ${cacheFile}.` }, "fails when links.json cannot be saved");

// --- needsSync ---
test.section("needsSync");

const now = new Date("2026-11-15T12:00:00Z");
test.assertTruthy(new LinkShortener(makeKutt(), makeFiles()).needsSync(7, now), "with no links.json");
test.assertTruthy(new LinkShortener(makeKutt(), makeFiles(savedFile([], [], null))).needsSync(7, now), "with no sync recorded");
test.assertFalsy(new LinkShortener(makeKutt(), makeFiles(savedFile([], [], "2026-11-09T12:00:00Z"))).needsSync(7, now), "not after six days");
test.assertTruthy(new LinkShortener(makeKutt(), makeFiles(savedFile([], [], "2026-11-08T11:00:00Z"))).needsSync(7, now), "after more than seven days");

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
test.assertEqual(settings.shortenPrompt.menuItems[0].data.initialText, undefined, "without changing the settings");

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

reset("https://lnk.test/s1");
ui = makeUI({ shown: true, url: "https://lnk.test/s1" });
kutt = makeKutt();
new ShortLinks(settings, ui, new LinkShortener(kutt, makeFiles(savedFile([link(1)])))).shortenPrompted();
test.assertEqual(ui.menus[0].menuItems[0].data.initialText, undefined, "does not start with a short link from the clipboard");
test.assertDeepEqual(calls.fail, ["https://lnk.test/s1 is already a short link."], "fails on one of our short links");
test.assertEqual(kutt.pages.length + kutt.created.length, 0, "without asking Kutt");

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
ui = makeUI({ shown: true, url: "a $& b" });
kutt = makeKutt();
new ShortLinks(settings, ui, new LinkShortener(kutt, makeFiles())).shortenPrompted();
test.assertDeepEqual(calls.fail, ['"a $& b" is not a link.'], "fails on text that is not a link, keeping $ as typed");
test.assertEqual(kutt.pages.length + kutt.created.length, 0, "without asking Kutt");

reset();
ui = makeUI({ shown: true, url: "https://example.com/x" });
new ShortLinks(settings, ui, new LinkShortener(makeKutt([], { failCreate: true }), makeFiles(savedFile([])))).shortenPrompted();
test.assertDeepEqual(calls.fail, ["Kutt Error: 400 - Create Link Failed: URL is not valid."], "fails with Kutt's error");
test.assertDeepEqual(ui.inserted, [], "inserts nothing on failure");

// --- automatic sync ---
test.section("automatic sync");

reset();
kutt = makeKutt([link(1)]);
files = makeFiles(savedFile([link(1)]));
new ShortLinks(settings, makeUI({ shown: true, url: "https://example.com/1" }), new LinkShortener(kutt, files)).shortenPrompted();
test.assertEqual(kutt.userCalls, 0, "skips the sync when the last one is recent");

reset();
kutt = makeKutt([link(1), link(2)], { domains: [{ address: "go.test" }] });
files = makeFiles(savedFile([link(1)], [], "2026-01-01T00:00:00Z"));
ui = makeUI({ shown: true, url: "https://example.com/2" });
test.assertEqual(new ShortLinks(settings, ui, new LinkShortener(kutt, files)).shortenPrompted(), "https://lnk.test/s2", "syncs when the last sync is old, then finds the link");
test.assertEqual(kutt.userCalls, 1, "runs one full sync");
test.assertDeepEqual(files.files[cacheFile].domains, ["go.test"], "which updates the domains");
test.assertTruthy(files.files[cacheFile].syncedAt > "2026-01-01", "and the sync time");

reset();
kutt = makeKutt([], { failUser: true });
files = makeFiles(savedFile([link(1)], [], "2026-01-01T00:00:00Z"));
ui = makeUI({ shown: true, url: "https://example.com/1" });
test.assertEqual(new ShortLinks(settings, ui, new LinkShortener(kutt, files)).shortenPrompted(), "https://lnk.test/s1", "still uses the cache when the sync fails");
test.assertDeepEqual(calls.fail, [], "without failing the action");

// --- Sync Kutt Links ---
test.section("Sync Kutt Links");

reset();
ui = makeUI();
test.assertEqual(new ShortLinks(settings, ui, new LinkShortener(makeKutt(server), makeFiles())).sync(), 120, "returns the count");
test.assertDeepEqual(ui.messages, [{ type: "success", message: "Synced 120 links from Kutt." }], "reports the count");

reset();
ui = makeUI();
new ShortLinks(settings, ui, new LinkShortener(makeKutt([], { failList: true }), makeFiles())).sync();
test.assertDeepEqual(calls.fail, ["Kutt Error: 401 - Get Links Failed: API key is not correct."], "fails with Kutt's error");

test.summary();
