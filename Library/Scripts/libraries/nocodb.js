class ATTable {
  constructor(nocodb, orgName, projectName, tableName) {
    this.#nocodb = nocodb;
    this.#orgName = orgName;
    this.#projectName = projectName;
    this.#tableName = tableName;
    this.#records = [];
    this.#params = {};
    this.#debug = false;
    this.#error = false;
    this.#errorMessage = "";
  }

  // Private properties
  #nocodb;
  #orgName;
  #projectName;
  #tableName;
  #records;
  #params;
  #debug;
  #error;
  #errorMessage;

  // Static error codes
  static errorCodes = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    500: "Internal Server Error",
    // Add more as needed
  };

  // Property methods
  get records() {
    return this.#records;
  }
  get firstRecord() {
    return this.#records[0];
  }
  set debug(value) {
    this.#debug = value;
  }
  get debug() {
    return this.#debug;
  }

  // Filter functions
  fields(...fields) {
    if (fields.length > 0) {
      this.#params.fields = fields.join(",");
    } else {
      delete this.#params.fields;
    }
    return this;
  }

  filterBy(filter) {
    this.#params.where = JSON.stringify(filter);
    return this;
  }

  sort(sortConfig) {
    if (sortConfig && typeof sortConfig === "object") {
      const sortParams = Object.entries(sortConfig)
        .map(([field, direction]) => `${field}:${direction}`)
        .join(",");
      this.#params.orderby = sortParams;
    } else {
      delete this.#params.orderby;
    }
    return this;
  }

  page(pageNumber) {
    if (pageNumber > 0) {
      this.#params.page = pageNumber;
    } else {
      delete this.#params.page;
    }
    return this;
  }

  pageSize(size) {
    if (size > 0) {
      this.#params.limit = size;
    } else {
      delete this.#params.limit;
    }
    return this;
  }

  // GET functions
  async select() {
    try {
      const url = `${this.#nocodb}/api/v1/db/data/${this.#orgName}/${
        this.#projectName
      }/${this.#tableName}`;
      const response = await this.#makeHTTPRequest("GET", url, this.#params);
      if (response.success) {
        this.#records = response.data;
      }
      return this.#records;
    } catch (error) {
      this.#requestError(error);
      return [];
    }
  }

  async findById(id) {
    try {
      const url = `${this.#nocodb}/api/v1/db/data/${this.#orgName}/${
        this.#projectName
      }/${this.#tableName}/${id}`;
      const response = await this.#makeHTTPRequest("GET", url, {});
      if (response.success) {
        this.#records = [response.data];
      }
      return this.#records[0] || null;
    } catch (error) {
      this.#requestError(error);
      return null;
    }
  }

  // POST functions
  async createRecords(records) {
    try {
      const url = `${this.#nocodb}/api/v1/db/data/${this.#orgName}/${
        this.#projectName
      }/${this.#tableName}`;
      const payload = { records };
      const response = await this.#makeHTTPRequest("POST", url, {}, payload);
      if (response.success) {
        this.#records = response.data;
      }
      return this.#records;
    } catch (error) {
      this.#requestError(error);
      return [];
    }
  }

  // PATCH functions
  async updateRecords(records) {
    try {
      const url = `${this.#nocodb}/api/v1/db/data/${this.#orgName}/${
        this.#projectName
      }/${this.#tableName}`;
      const payload = { records };
      const response = await this.#makeHTTPRequest("PATCH", url, {}, payload);
      if (response.success) {
        this.#records = response.data;
      }
      return this.#records;
    } catch (error) {
      this.#requestError(error);
      return [];
    }
  }

  // DELETE functions
  async deleteRecords(ids) {
    try {
      const url = `${this.#nocodb}/api/v1/db/data/${this.#orgName}/${
        this.#projectName
      }/${this.#tableName}`;
      const payload = { ids };
      const response = await this.#makeHTTPRequest("DELETE", url, {}, payload);
      if (response.success) {
        this.#records = [];
      }
      return response.success;
    } catch (error) {
      this.#requestError(error);
      return false;
    }
  }

  // Other functions
  async saveRecords(records) {
    let success = false;
    if (!Array.isArray(records)) records = [records];
    const recordsToUpdate = records.filter((record) => record.id);
    const recordsToCreate = records.filter((record) => !record.id);

    if (recordsToUpdate.length > 0) {
      success = await this.updateRecords(recordsToUpdate);
    }
    if (recordsToCreate.length > 0 && success !== false) {
      success = await this.createRecords(recordsToCreate);
    }

    return success;
  }

  // Private functions
  async #makeHTTPRequest(method, url, params, data = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${url}?${queryString}`;
    const headers = {
      Authorization: `Bearer ${this.#nocodb.apiKey}`,
      "Content-Type": "application/json",
    };

    try {
      const response = await fetch(fullUrl, {
        method: method,
        headers: headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const responseData = await response.json();
      return { success: true, data: responseData };
    } catch (error) {
      return this.#requestError(error);
    }
  }

  #requestError(error) {
    this.#error = true;
    this.#errorMessage = `NocoDB Error: ${error.message}`;
    if (this.#debug) console.error(this.#errorMessage);

    // Optionally, display error message to the user
    app.displayErrorMessage(this.#errorMessage);

    return { success: false };
  }
}
