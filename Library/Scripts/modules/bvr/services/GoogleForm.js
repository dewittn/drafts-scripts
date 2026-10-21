class GoogleForm {
  static viewPath = "viewform";
  static submitPath = "formResponse";
  #settings;
  #formData;

  constructor(dependencies) {
    this.#settings = dependencies.settings;
    this.#formData = dependencies.formData;
  }

  // The form's base link, as submit() expects it, from whatever was pasted:
  // drops a query string, a trailing /viewform, /formResponse or /edit, and
  // a trailing slash. Returns undefined for anything that is not a web link.
  static baseURL(pasted) {
    const url = `${pasted || ""}`.trim().split(/[?#]/)[0];
    if (!/^https?:\/\/\S+$/.test(url)) return undefined;
    return url.replace(/\/(viewform|formResponse|edit)\/?$/, "").replace(/\/+$/, "");
  }

  get fields() {
    return this.#settings.fields;
  }

  get formURL() {
    return this.#settings.url;
  }

  get postData() {
    return this.#settings?.postData;
  }

  get viewPath() {
    return this.constructor.viewPath;
  }

  get submitPath() {
    return this.constructor.submitPath;
  }

  get urlPath() {
    if (this.postForm) return this.submitPath;
    return this.viewPath;
  }

  get postForm() {
    return this.postData != undefined && this.postData == true;
  }

  get submitString() {
    if (this.postForm == false) return "";
    return "submit=Submit&";
  }

  submit() {
    const queryString = this.fields
      .map((feild) => {
        const fieldData = this.#formData[feild.key];
        if (fieldData != undefined) {
          return `entry.${feild.entryID}=${encodeURIComponent(fieldData)}`;
        }
      })
      .join("&");

    const submitURL =
      `${this.formURL}/${this.urlPath}?${this.submitString}usp=pp_url&${queryString}`;
    app.openURL(submitURL);
  }
}
