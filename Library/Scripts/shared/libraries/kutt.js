// Kutt.it URL Shortener by Nelson/Roberto (@dewittn)
// A Kutt.it API wrapper for Drafts

// ***************
// * Kutt Class
// ***************
class Kutt {
  // Links asked for per list request. getAllLinks keeps asking until it has them all.
  static pageSize = 50;

  #apiKey;
  #domain;
  #endPointURL;

  constructor() {
    this.#authorize();
    this.#endPointURL = `${this.#domain}/api/v2`;
  }

  get endPointURL() {
    return this.#endPointURL;
  }

  get apiKey() {
    return this.#apiKey;
  }

  get domain() {
    return this.#domain;
  }

  // The default short link domain without its scheme, e.g. "lnk.example".
  get host() {
    return LinkShortener.hostOf(this.#domain);
  }

  // Setup & Store Credentials
  #authorize() {
    let credential = Credential.create("Kutt", "Kutt.it API");
    credential.addTextField("domain", "Domain (e.g., https://kutt.it)");
    credential.addPasswordField("api_key", "API Key");
    credential.authorize();
    // Trailing slashes dropped so "https://lnk.example/" still builds ".../api/v2".
    const domain = credential.getValue("domain") || "https://kutt.it";
    this.#domain = domain.trim().replace(/\/+$/, "");
    this.#apiKey = credential.getValue("api_key");
  }

  // Create a short link. reuse: true makes Kutt hand back an existing short
  // link for the same target instead of making a duplicate.
  createLink(target, options = {}) {
    const url = `${this.#endPointURL}/links`;
    // any: HTTP sends data as JSON, but its type only allows string values.
    /** @type {any} */
    const body = {
      target: target,
      reuse: true,
      ...options
    };

    let http = HTTP.create();
    let response = http.request({
      url: url,
      method: "POST",
      headers: {
        "X-API-Key": this.#apiKey,
        "Content-Type": "application/json"
      },
      data: body
    });

    if (!response.success) {
      return this.#requestError(response, "Create Link Failed");
    }

    return JSON.parse(response.responseText);
  }

  // Get all links
  getLinks(params = {}) {
    // Set defaults for pagination
    const queryParams = {
      limit: params.limit || 50,
      skip: params.skip || 0,
      all: params.all || false
    };

    let queryString = "?" + Object.entries(queryParams)
      .map(([key, val]) => `${key}=${encodeURIComponent(val)}`)
      .join("&");

    const url = `${this.#endPointURL}/links${queryString}`;

    let http = HTTP.create();
    let response = http.request({
      url: url,
      method: "GET",
      headers: {
        "X-API-Key": this.#apiKey
      }
    });

    if (!response.success) {
      return this.#requestError(response, "Get Links Failed");
    }

    return JSON.parse(response.responseText);
  }

  // Every link on the account, one page at a time until Kutt's total is
  // reached. Returns { data } like getLinks, or the error from a failed page.
  getAllLinks() {
    const pageSize = Kutt.pageSize;
    const links = [];

    while (true) {
      const page = this.getLinks({ limit: pageSize, skip: links.length });
      if (!page || page.success === false) return page;

      const data = Array.isArray(page.data) ? page.data : [];
      links.push(...data);
      if (data.length < pageSize || links.length >= page.total) break;
    }

    return { data: links, total: links.length };
  }

  // Get link by ID
  getLink(id) {
    const url = `${this.#endPointURL}/links/${id}`;

    let http = HTTP.create();
    let response = http.request({
      url: url,
      method: "GET",
      headers: {
        "X-API-Key": this.#apiKey
      }
    });

    if (!response.success) {
      return this.#requestError(response, "Get Link Failed");
    }

    return JSON.parse(response.responseText);
  }

  // Update link by ID
  updateLink(id, target, address) {
    const url = `${this.#endPointURL}/links/${id}`;

    let http = HTTP.create();
    let response = http.request({
      url: url,
      method: "PATCH",
      headers: {
        "X-API-Key": this.#apiKey,
        "Content-Type": "application/json"
      },
      data: { target, address }
    });

    if (!response.success) {
      return this.#requestError(response, "Update Link Failed");
    }

    return JSON.parse(response.responseText);
  }

  // Delete link by ID
  deleteLink(id) {
    const url = `${this.#endPointURL}/links/${id}`;

    let http = HTTP.create();
    let response = http.request({
      url: url,
      method: "DELETE",
      headers: {
        "X-API-Key": this.#apiKey
      }
    });

    if (!response.success) {
      return this.#requestError(response, "Delete Link Failed");
    }

    return { success: true };
  }

  // Get link statistics
  getLinkStats(id) {
    const url = `${this.#endPointURL}/links/${id}/stats`;

    let http = HTTP.create();
    let response = http.request({
      url: url,
      method: "GET",
      headers: {
        "X-API-Key": this.#apiKey
      }
    });

    if (!response.success) {
      return this.#requestError(response, "Get Stats Failed");
    }

    return JSON.parse(response.responseText);
  }

  // Get user info
  getUserInfo() {
    const url = `${this.#endPointURL}/users`;

    let http = HTTP.create();
    let response = http.request({
      url: url,
      method: "GET",
      headers: {
        "X-API-Key": this.#apiKey
      }
    });

    if (!response.success) {
      return this.#requestError(response, "Get User Info Failed");
    }

    return JSON.parse(response.responseText);
  }

  // Logs the failure and returns it. Callers decide how to show it, so the
  // user sees one message rather than a banner plus the action's own.
  #requestError(response, message) {
    const errorMessage = `Kutt Error: ${response.statusCode} - ${message}`;
    console.log(`${errorMessage}\n${response.responseText}`);
    return { success: false, error: errorMessage, statusCode: response.statusCode };
  }
}

// ***************
// * LinkShortener Class
// ***************
// Short links kept in links.json so a lookup needs no request. Links are
// matched by target URL and short link domain, so one page can have a short
// link on each domain. The file also keeps the custom domains from the last
// sync, for the domain menu.
class LinkShortener {
  #kutt;
  #fmCloud;
  #cacheFile = "/Library/Data/links.json";
  #links = new Map();
  #customDomains = [];

  // kutt and fileManager can be swapped for stubs in tests.
  constructor(kutt = new Kutt(), fileManager = FileManager.createCloud()) {
    this.#kutt = kutt;
    this.#fmCloud = fileManager;
    this.loadCache();
  }

  // True when text is a single http(s) link and nothing else.
  static isURL(text) {
    return /^https?:\/\/\S+$/i.test(String(text ?? "").trim());
  }

  // The host of a URL, lowercased: "https://Lnk.example/abc" → "lnk.example".
  static hostOf(url) {
    return String(url ?? "").trim().replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  }

  // A target URL in the form links are matched by: trimmed, scheme and host
  // lowercased, trailing slashes dropped. So ".../post/" finds ".../post".
  static normalizeURL(url) {
    const trimmed = String(url ?? "").trim().replace(/\/+$/, "");
    return trimmed.replace(/^(https?:\/\/[^/?#]+)/i, (origin) => origin.toLowerCase());
  }

  // Map key for a target on a domain.
  static #key(target, domain) {
    return `${domain} ${LinkShortener.normalizeURL(target)}`;
  }

  // Kutt's default domain first, then the custom domains from the last sync.
  get domains() {
    return [...new Set([this.#kutt.host, ...this.#customDomains])];
  }

  // Every cached link.
  get links() {
    return Array.from(this.#links.values());
  }

  // The cached link for a target on a domain (the default when omitted).
  lookup(target, domain = this.#kutt.host) {
    return this.#links.get(LinkShortener.#key(target, domain));
  }

  // Reads links.json. Older files are a plain { target: link } object.
  loadCache() {
    try {
      if (!this.#fmCloud.exists(this.#cacheFile)) return;

      const data = this.#fmCloud.readJSON(this.#cacheFile);
      if (!data || typeof data !== "object") return;

      const links = Array.isArray(data.links) ? data.links : Object.values(data);
      this.#customDomains = Array.isArray(data.domains) ? data.domains : [];
      this.#links.clear();
      links.forEach((link) => this.#remember(link));
      console.log(`Loaded ${this.#links.size} links from cache`);
    } catch (error) {
      console.log(`Error loading cache: ${error}`);
    }
  }

  // Writes links.json.
  #saveCache() {
    try {
      this.#fmCloud.writeJSON(this.#cacheFile, { domains: this.#customDomains, links: this.links });
      console.log(`Saved ${this.#links.size} links to cache`);
    } catch (error) {
      console.log(`Error saving cache: ${error}`);
    }
  }

  // Adds a Kutt link to the map. When two links share a target and domain,
  // the older one is kept, so repeat syncs always give the same short link.
  #remember(link) {
    if (!link?.target || !link?.link) return;

    const key = LinkShortener.#key(link.target, LinkShortener.hostOf(link.link));
    const existing = this.#links.get(key);
    if (existing && String(existing.created_at) <= String(link.created_at)) return;
    this.#links.set(key, link);
  }

  // The short link for target on domain (Kutt's default when omitted): from
  // the cache when there, otherwise created on Kutt and cached.
  shorten(target, domain = this.#kutt.host) {
    target = target.trim();

    const cached = this.lookup(target, domain);
    if (cached) {
      console.log(`Cache hit for: ${target} on ${domain}`);
      return cached;
    }

    console.log(`Cache miss for: ${target} on ${domain}, calling API`);
    const options = domain == this.#kutt.host ? {} : { domain };
    const result = this.#kutt.createLink(target, options);

    if (result?.link) {
      this.#remember(result);
      this.#saveCache();
    }
    return result;
  }

  // Replaces the cache with every link and custom domain on Kutt.
  sync() {
    console.log("Syncing links from API...");

    const result = this.#kutt.getAllLinks();
    if (!Array.isArray(result?.data)) return { success: false, error: result?.error ?? "Failed to sync links" };

    const user = this.#kutt.getUserInfo();
    if (!Array.isArray(user?.domains)) return { success: false, error: user?.error ?? "Failed to get domains" };

    this.#customDomains = user.domains.filter((domain) => !domain.banned).map((domain) => domain.address.toLowerCase());
    this.#links.clear();
    result.data.forEach((link) => this.#remember(link));
    this.#saveCache();

    console.log(`Synced ${result.data.length} links to cache`);
    return { success: true, count: result.data.length };
  }

  // Empties the cache, keeping the domains.
  clearCache() {
    this.#links.clear();
    this.#saveCache();
  }

  // Deletes a link on Kutt and drops it from the cache.
  deleteLink(link) {
    const result = this.#kutt.deleteLink(link.id);
    if (!result?.success) return result;

    const key = LinkShortener.#key(link.target, LinkShortener.hostOf(link.link));
    if (this.#links.get(key)?.id == link.id) this.#links.delete(key);
    this.#saveCache();
    return result;
  }
}
