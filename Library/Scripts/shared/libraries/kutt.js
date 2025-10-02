// Kutt.it URL Shortener by Nelson/Roberto (@dewittn)
// A Kutt.it API wrapper for Drafts

// ***************
// * Kutt Class
// ***************
class Kutt {
  static filesPath = "/Library/Data";

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

  get filesPath() {
    return this.constructor.filesPath;
  }

  get apiKey() {
    return this.#apiKey;
  }

  get domain() {
    return this.#domain;
  }

  // Setup & Store Credentials
  #authorize() {
    let credential = Credential.create("Kutt", "Kutt.it API");
    credential.addTextField("domain", "Domain (e.g., https://kutt.it)");
    credential.addPasswordField("api_key", "API Key");
    credential.authorize();
    this.#domain = credential.getValue("domain") || "https://kutt.it";
    this.#apiKey = credential.getValue("api_key");
  }

  // Create a short link
  createLink(target, options = {}) {
    const url = `${this.#endPointURL}/links`;
    const body = {
      target: target,
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

  // Error handling
  #requestError(response, message) {
    const errorMessage = `Kutt Error: ${response.statusCode} - ${message}`;
    app.displayErrorMessage(errorMessage);
    console.log(`${errorMessage}\n${response.responseText}`);
    return { success: false, error: errorMessage, statusCode: response.statusCode };
  }
}

// ***************
// * LinkShortener Class
// ***************
class LinkShortener {
  #kutt;
  #cache;
  #cacheFile = "/Library/Data/links.json";
  #fmCloud;

  constructor() {
    this.#kutt = new Kutt();
    this.#fmCloud = FileManager.createCloud();
    this.#cache = new Map();
    this.loadCache();
  }

  // Load cached links from JSON file
  loadCache() {
    try {
      if (this.#fmCloud.exists(this.#cacheFile)) {
        const data = this.#fmCloud.readJSON(this.#cacheFile);
        if (data && typeof data === "object") {
          // Convert object to Map
          for (const [key, value] of Object.entries(data)) {
            this.#cache.set(key, value);
          }
          console.log(`Loaded ${this.#cache.size} links from cache`);
        }
      } else {
        console.log("Cache file does not exist. Starting with empty cache.");
      }
    } catch (error) {
      console.log(`Error loading cache: ${error}`);
      // Initialize with empty cache if file doesn't exist or is invalid
      this.#cache = new Map();
    }
  }

  // Save cache to JSON file
  #saveCache() {
    try {
      // Convert Map to plain object for JSON
      const cacheObject = Object.fromEntries(this.#cache);
      this.#fmCloud.writeJSON(this.#cacheFile, cacheObject);
      console.log(`Saved ${this.#cache.size} links to cache`);
    } catch (error) {
      console.log(`Error saving cache: ${error}`);
    }
  }

  // Shorten a URL (check cache first)
  shorten(target, options = {}) {
    // Check cache first
    if (this.#cache.has(target)) {
      console.log(`Cache hit for: ${target}`);
      return this.#cache.get(target);
    }

    // Not in cache, call API
    console.log(`Cache miss for: ${target}, calling API`);
    const result = this.#kutt.createLink(target, options);

    if (result && !result.error && result.link) {
      // Add to cache using target URL as key
      this.#cache.set(target, result);
      this.#saveCache();
    }

    return result;
  }

  // Sync all links from API and update cache
  sync() {
    console.log("Syncing links from API...");

    // Fetch all links by setting all=true
    const result = this.#kutt.getLinks({ all: true });

    if (result && result.data && Array.isArray(result.data)) {
      // Clear existing cache
      this.#cache.clear();

      // Add all links to cache, using target URL as key
      for (const link of result.data) {
        if (link.target) {
          this.#cache.set(link.target, link);
        }
      }

      // Save updated cache
      this.#saveCache();
      console.log(`Synced ${result.data.length} links to cache`);
      return { success: true, count: result.data.length };
    }

    return { success: false, error: "Failed to sync links" };
  }

  // Get a link from cache by target URL
  getFromCache(target) {
    return this.#cache.get(target);
  }

  // Check if a URL is in cache
  isCached(target) {
    return this.#cache.has(target);
  }

  // Get all cached links
  getAllCached() {
    return Array.from(this.#cache.values());
  }

  // Get cache size
  getCacheSize() {
    return this.#cache.size;
  }

  // Clear cache
  clearCache() {
    this.#cache.clear();
    this.#saveCache();
    console.log("Cache cleared");
  }

  // Delete a link (from API and cache)
  deleteLink(id, target) {
    const result = this.#kutt.deleteLink(id);

    if (result && result.success) {
      // Remove from cache if target URL is provided
      if (target && this.#cache.has(target)) {
        this.#cache.delete(target);
        this.#saveCache();
      }
    }

    return result;
  }

  // Get direct access to Kutt instance for advanced operations
  getKuttInstance() {
    return this.#kutt;
  }
}
