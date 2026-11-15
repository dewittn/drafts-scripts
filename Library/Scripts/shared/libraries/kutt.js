// Kutt URL Shortener by Nelson/Roberto (@dewittn)
// A Kutt API wrapper for Drafts, and a local cache of its short links.

// ***************
// * Kutt Class
// ***************
// The Kutt address and API key are asked for once and kept in Drafts'
// Credentials. The address should be Kutt's default domain (its
// DEFAULT_DOMAIN), since its host is treated as the default short link domain.
class Kutt {
  // Kutt returns at most 50 links per list request.
  static pageSize = 50;

  #apiKey;
  #domain;
  #endPointURL;

  constructor() {
    this.#authorize();
    this.#endPointURL = `${this.#domain}/api/v2`;
  }

  // The host of a URL, lowercased: "https://Lnk.example/abc" → "lnk.example".
  static hostOf(url) {
    return String(url ?? "").trim().replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  }

  // The default short link domain without its scheme, e.g. "lnk.example".
  get host() {
    return Kutt.hostOf(this.#domain);
  }

  // Reads the Kutt address and API key, asking for them the first time.
  #authorize() {
    const credential = Credential.create("Kutt", "Kutt.it API");
    credential.addTextField("domain", "Kutt address (e.g., https://lnk.example.com)");
    credential.addPasswordField("api_key", "API Key");
    credential.authorize();
    this.#domain = Kutt.#baseURL(credential.getValue("domain"));
    this.#apiKey = credential.getValue("api_key");
  }

  // The Kutt address as "https://host", whatever form it was typed in. Throws
  // when it is blank, so the API key is never sent to a guessed server.
  static #baseURL(domain) {
    const trimmed = String(domain ?? "").trim().replace(/\/+$/, "");
    if (trimmed == "") throw new Error("No Kutt address saved. Reset the Kutt credential in Drafts settings.");
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  // Creates a short link. reuse: true makes Kutt hand back an existing short
  // link for the same target instead of making a duplicate.
  createLink(target, options = {}) {
    return this.#request("POST", "/links", "Create Link Failed", { target, reuse: true, ...options });
  }

  // Changes a link's target, address or description. Kutt ignores blank
  // values, so a field can be changed but not cleared.
  updateLink(id, changes) {
    return this.#request("PATCH", `/links/${id}`, "Update Link Failed", changes);
  }

  // Deletes a link. The short link stops working; this cannot be undone.
  deleteLink(id) {
    return this.#request("DELETE", `/links/${id}`, "Delete Link Failed");
  }

  // One page of links, newest first: { total, limit, skip, data }.
  getLinks({ limit = Kutt.pageSize, skip = 0 } = {}) {
    return this.#request("GET", `/links?limit=${limit}&skip=${skip}`, "Get Links Failed");
  }

  // Every link on the account, one page at a time until Kutt's total is
  // reached. Returns { data } like getLinks, or the error from a failed page.
  getAllLinks() {
    const links = [];

    while (true) {
      const page = this.getLinks({ skip: links.length });
      if (page.success === false) return page;

      const data = Array.isArray(page.data) ? page.data : [];
      links.push(...data);
      if (data.length == 0 || links.length >= page.total) break;
    }

    return { data: links, total: links.length };
  }

  // The account's email and custom domains: { email, domains }.
  getUserInfo() {
    return this.#request("GET", "/users", "Get User Info Failed");
  }

  // Sends one API request and returns the parsed reply, or
  // { success: false, error } when it fails.
  #request(method, path, failMessage, data) {
    /** @type {any} */
    const request = { url: `${this.#endPointURL}${path}`, method, headers: { "X-API-Key": this.#apiKey } };
    if (data) Object.assign(request, { encoding: "json", data });

    const response = HTTP.create().request(request);
    if (!response.success) return this.#requestError(response, failMessage);

    try {
      return JSON.parse(response.responseText);
    } catch (error) {
      return this.#requestError(response, `${failMessage}: reply is not JSON`);
    }
  }

  // Logs the failure and returns it with Kutt's reason, such as "URL is not
  // valid.". Callers decide how to show it.
  #requestError(response, message) {
    const reason = Kutt.#errorReason(response);
    const errorMessage = `Kutt Error: ${response.statusCode} - ${message}${reason ? `: ${reason}` : ""}`;
    console.log(`${errorMessage}\n${response.responseText}`);
    return { success: false, error: errorMessage, statusCode: response.statusCode };
  }

  // Kutt replies to a rejected request with { error: "..." }. A request that
  // never reached Kutt has the reason in response.error instead.
  static #errorReason(response) {
    try {
      return JSON.parse(response.responseText).error ?? response.error;
    } catch (error) {
      return response.error;
    }
  }
}

// ***************
// * LinkShortener Class
// ***************
// Short links kept in links.json so a lookup needs no request. Links are
// matched by target URL only: a page already shortened on any domain gets
// that link back, and the domain only matters when a new link is made. The
// file also keeps the custom domains for the domain menu and the last sync time.
class LinkShortener {
  static cacheFile = "/Library/Data/links.json";

  #kutt;
  #files;
  #links = new Map();
  #customDomains = [];
  #syncedAt;

  // kutt and fileManager can be swapped for stubs in tests.
  constructor(kutt = new Kutt(), fileManager = FileManager.createCloud()) {
    this.#kutt = kutt;
    this.#files = fileManager;
    this.#loadCache();
  }

  // True when text is a single http(s) link and nothing else.
  static isURL(text) {
    return /^https?:\/\/\S+$/i.test(String(text ?? "").trim());
  }

  // A target URL in the form links are matched by: trimmed, scheme and host
  // lowercased, trailing slashes dropped. So ".../post/" finds ".../post".
  static normalizeURL(url) {
    const trimmed = String(url ?? "").trim().replace(/\/+$/, "");
    return trimmed.replace(/^(https?:\/\/[^/?#]+)/i, (origin) => origin.toLowerCase());
  }

  // Kutt's default domain first, then the custom domains from the last sync.
  get domains() {
    return [...new Set([this.#kutt.host, ...this.#customDomains])];
  }

  // Every cached link.
  get links() {
    return Array.from(this.#links.values());
  }

  // True when url is a short link on one of the account's domains.
  isShortLink(url) {
    return this.domains.includes(Kutt.hostOf(url));
  }

  // True when the last sync is more than days old, or there has not been one.
  needsSync(days, now = new Date()) {
    if (this.#syncedAt == undefined) return true;
    return now.getTime() - Date.parse(this.#syncedAt) > days * 24 * 60 * 60 * 1000;
  }

  // The cached link whose short link is url.
  byShortLink(url) {
    return this.links.find((link) => link.link == url);
  }

  // The cached link for a target, on whichever domain it was made.
  lookup(target) {
    return this.#links.get(LinkShortener.normalizeURL(target));
  }

  // The short link for target: from the cache, then from Kutt's newest links,
  // otherwise made on domain (Kutt's default when omitted) with description,
  // and cached. An existing link keeps its own domain and description.
  shorten(target, { domain = this.#kutt.host, description = "" } = {}) {
    target = target.trim();

    const found = this.lookup(target) ?? this.#lookupNewest(target);
    if (found) return found;

    console.log(`No short link for ${target}, creating one on ${domain}`);
    const result = this.#kutt.createLink(target, this.#createOptions(domain, description));

    if (result.link) {
      this.#remember(result);
      this.#saveCache();
    }
    return result;
  }

  // Only what differs from Kutt's defaults: a custom domain, a description.
  #createOptions(domain, description) {
    const options = {};
    if (domain != this.#kutt.host) options.domain = domain;
    if (description.trim()) options.description = description.trim();
    return options;
  }

  // Saves changes ({ target, address, description }) to a link on Kutt and in
  // the cache. Returns the updated link, or Kutt's failure. The short link is
  // worked out here, since Kutt's reply can give a custom-domain link the
  // default domain.
  update(link, changes) {
    const result = this.#kutt.updateLink(link.id, changes);
    if (result.success === false) return result;

    const shortLink = changes.address ? link.link.replace(/[^/]+$/, changes.address) : link.link;
    const updated = { ...link, ...changes, link: shortLink, updated_at: result.updated_at ?? link.updated_at };

    const oldKey = LinkShortener.normalizeURL(link.target);
    if (this.#links.get(oldKey)?.id == link.id) this.#links.delete(oldKey);
    this.#links.set(LinkShortener.normalizeURL(updated.target), updated);
    this.#saveCache();
    return updated;
  }

  // Deletes a link on Kutt and drops it from the cache. Returns
  // { success: true }, or Kutt's failure.
  delete(link) {
    const result = this.#kutt.deleteLink(link.id);
    if (result.success === false) return result;

    const key = LinkShortener.normalizeURL(link.target);
    if (this.#links.get(key)?.id == link.id) this.#links.delete(key);
    this.#saveCache();
    return { success: true };
  }

  // Replaces the cache with every link and custom domain on Kutt, and records
  // when. Returns { success, count } with the number of pages cached, which
  // can be fewer than Kutt's links when a page has more than one.
  sync(now = new Date()) {
    const result = this.#kutt.getAllLinks();
    if (result.success === false) return result;

    const user = this.#kutt.getUserInfo();
    if (user.success === false) return user;

    this.#customDomains = (user.domains ?? []).filter((domain) => !domain.banned).map((domain) => domain.address.toLowerCase());
    this.#links.clear();
    (result.data ?? []).forEach((link) => this.#remember(link));
    this.#syncedAt = now.toISOString();

    if (!this.#saveCache()) return { success: false, error: `Could not save ${LinkShortener.cacheFile}.` };
    return { success: true, count: this.#links.size };
  }

  // Adds Kutt's newest page of links to the cache and looks again, so a link
  // made outside Drafts since the last sync (by the website) is found even
  // when its URL differs by a trailing slash.
  #lookupNewest(target) {
    const page = this.#kutt.getLinks();
    if (!Array.isArray(page.data)) return undefined;

    page.data.forEach((link) => this.#remember(link));
    const found = this.lookup(target);
    if (found) this.#saveCache();
    return found;
  }

  // Adds a Kutt link to the map. When two links share a target, the older
  // one is kept, so repeat syncs always give the same short link.
  #remember(link) {
    if (!link?.target || !link?.link) return;

    const key = LinkShortener.normalizeURL(link.target);
    const existing = this.#links.get(key);
    if (existing && String(existing.created_at) <= String(link.created_at)) return;
    this.#links.set(key, link);
  }

  // Reads links.json: { syncedAt, domains, links }.
  #loadCache() {
    const file = LinkShortener.cacheFile;
    const data = this.#files.exists(file) ? this.#files.readJSON(file) : undefined;
    if (!Array.isArray(data?.links)) return;

    this.#syncedAt = data.syncedAt;
    this.#customDomains = Array.isArray(data.domains) ? data.domains : [];
    data.links.forEach((link) => this.#remember(link));
  }

  // Writes links.json. Returns false when the write fails.
  #saveCache() {
    const data = { syncedAt: this.#syncedAt, domains: this.#customDomains, links: this.links };
    const saved = this.#files.writeJSON(LinkShortener.cacheFile, data);
    if (!saved) console.log(`Could not save ${LinkShortener.cacheFile}`);
    return saved;
  }
}
