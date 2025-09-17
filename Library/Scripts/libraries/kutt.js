class KuttItAPI {
  constructor() {
    this.#authorize();
    this.baseURL = `${this.domain}/api/v2`;
  }

  async request(endpoint, method = "GET", data = null) {
    const headers = {
      "Content-Type": "application/json",
      "X-API-KEY": this.apiKey,
    };

    let options = {
      method: method,
      headers: headers,
    };

    if (data && ["POST", "PATCH"].includes(method)) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, options);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  // Health Check
  async getHealth() {
    return this.request("/health");
  }

  // Links
  async getLinks(limit = 10, skip = 0, all = false) {
    const params = new URLSearchParams({ limit, skip, all });
    return this.request(`/links?${params.toString()}`);
  }

  async createLink(
    target,
    description = "",
    expire_in = "",
    password = "",
    customurl = "",
    reuse = false,
    domain = ""
  ) {
    return this.request("/links", "POST", {
      target,
      description,
      expire_in,
      password,
      customurl,
      reuse,
      domain,
    });
  }

  async deleteLink(id) {
    return this.request(`/links/${id}`, "DELETE");
  }

  async updateLink(id, target, address) {
    return this.request(`/links/${id}`, "PATCH", { target, address });
  }

  async getLinkStats(id) {
    return this.request(`/links/${id}/stats`);
  }

  // Domains
  async createDomain(address, homepage = "") {
    return this.request("/domains", "POST", { address, homepage });
  }

  async deleteDomain(id) {
    return this.request(`/domains/${id}`, "DELETE");
  }

  // Users
  async getUserInfo() {
    return this.request("/users");
  }

  // Setup & Store Credentials
  #authorize() {
    const credential = Credential.create("Kutt", "Kutt API");
    credential.addTextField("domain", "Domain of Kutt");
    credential.addPasswordField("api_key", "API Key");
    credential.authorize();
    this.domain = credential.getValue("domain");
    this.apiKey = credential.getValue("api_key");
  }

  #makeHTTPRequest(payload, id = "") {
    const url = `${this.endPointURL}/${this.baseID}/${this.URLSafeName}/${id}`;
    if (this.offset) payload.parameters["offset"] = this.offset;

    let debugMessage = `\n---------\nURL: ${url}\n\nPayload: ${JSON.stringify(
      payload
    )}`;

    const request = Object.assign(
      {
        url: url,
        headers: {
          Authorization: `Bearer ${this.#airtable.apiKey}`,
          "Content-Type": "application/json",
        },
      },
      payload
    );
    const http = HTTP.create();
    const response = http.request(request);

    if (response.success == false)
      return this.#requestError(response, debugMessage);

    const results = {
      success: response.success,
      data: this.#formatResponseText(response?.responseText),
    };

    debugMessage = `${debugMessage}\n\nResponse: ${response.responseText}`;
    if (this.#debug) console.log(debugMessage);

    // save offset and clear params once request is complete
    this.offset = results.offset;
    this.#params = {};

    return results;
  }
}

// const fs = require("fs").promises;
// const path = require("path");
//
// class KuttItManager {
// constructor(apiKey, filePath) {
//   this.apiClient = new KuttItAPI(apiKey);
//   this.filePath = filePath;
//   this.linksMap = new Map();
// }
//
// // Method to retrieve all links and save them in a JSON file
// async fetchAndSaveLinks() {
//   try {
//     const response = await this.apiClient.getLinks(); // Fetching all links
//     const linksData = response.data;
//
//     // Creating a map where URL is the key and link data is the value
//     const linksMap = new Map();
//     linksData.forEach((link) => {
//       linksMap.set(link.target, link);
//     });
//
//     // Saving the map to a JSON file
//     await fs.writeFile(
//       this.filePath,
//       JSON.stringify(Object.fromEntries(linksMap), null, 2)
//     );
//     this.linksMap = linksMap;
//   } catch (error) {
//     console.error("Error fetching and saving links:", error);
//   }
// }
//
// // Method to load the JSON file into a map object
// async loadLinksFromFile() {
//   try {
//     const fileExists = await fs
//       .access(this.filePath, fs.constants.F_OK)
//       .then(() => true)
//       .catch(() => false);
//
//     if (!fileExists) {
//       console.log("File does not exist. Fetching and saving links...");
//       await this.fetchAndSaveLinks();
//     }
//
//     const data = await fs.readFile(this.filePath, "utf8");
//     const linksObject = JSON.parse(data);
//     this.linksMap = new Map(Object.entries(linksObject));
//   } catch (error) {
//     console.error("Error loading links from file:", error);
//   }
// }
//
// // Method to create a new link with a check in the map object
// async createLink(
//   target,
//   description = "",
//   expire_in = "",
//   password = "",
//   customurl = "",
//   reuse = false,
//   domain = ""
// ) {
//   try {
//     if (this.linksMap.has(target)) {
//       console.log("Link already exists for this URL:", target);
//       return this.linksMap.get(target);
//     }
//
//     const newLink = await this.apiClient.createLink(
//       target,
//       description,
//       expire_in,
//       password,
//       customurl,
//       reuse,
//       domain
//     );
//     this.linksMap.set(newLink.target, newLink);
//
//     // Optionally, update the JSON file with the new link
//     await fs.writeFile(
//       this.filePath,
//       JSON.stringify(Object.fromEntries(this.linksMap), null, 2)
//     );
//
//     return newLink;
//   } catch (error) {
//     console.error("Error creating link:", error);
//   }
// }
// }
//
// // Example usage:
// (async () => {
// const apiKey = "your_api_key_here";
// const filePath = path.join(__dirname, "links.json");
// const kuttItManager = new KuttItManager(apiKey, filePath);
//
// try {
//   // Fetch and save links
//   await kuttItManager.fetchAndSaveLinks();
//   console.log("Links fetched and saved.");
//
//   // Load links from file
//   await kuttItManager.loadLinksFromFile();
//   console.log("Links loaded from file.");
//
//   // Create a new link
//   const newLink = await kuttItManager.createLink(
//     "https://example.com",
//     "Example link"
//   );
//   if (newLink) {
//     console.log("New link created:", newLink);
//   }
// } catch (error) {
//   console.error("Error in KuttItManager operations:", error);
// }
// })();
