// Bear.js by Nelson/Roberto (@dewittn)
// A simple interface for Drafts to interact with the Bear notes app
// Written against Bear x-callback-url API
// https://bear.app/faq/x-callback-url-scheme-documentation/

class Bear {
  static callbackURL = "bear://x-callback-url/";
  #debug = false;
  #errorCode;
  #errorMessage;

  constructor() {}

  static create() {
    return new Bear();
  }

  // ***********
  // * Class Properties
  // ***********
  get debug() {
    return this.#debug;
  }

  set debug(state) {
    if (state == false) return;

    this.#debug = true;
  }

  get callbackURL() {
    return this.constructor.callbackURL;
  }

  get error() {
    return this.#errorCode != undefined;
  }

  get errorCode() {
    return this.#errorCode;
  }

  get errorMessage() {
    return this.#errorMessage;
  }

  // ***********
  // * Bear API Functions
  // ***********

  // Create a new note in Bear
  create(title, text = "", tags = "") {
    let params = {};
    if (title) params["title"] = title;
    if (text) params["text"] = text;
    if (tags) params["tags"] = tags;

    const response = this.#openCallback("create", params);
    return response?.identifier ? new BearNote(response) : response;
  }

  // Add text to a note
  addText(id, title, text, mode = "append", openNote = "no") {
    let params = { text: text, mode: mode, open_note: openNote };

    if (id) {
      params["id"] = id;
    } else if (title) {
      params["title"] = title;
    } else {
      return this.#displayErrorMessage("Either id or title is required!");
    }

    const response = this.#openCallback("add-text", params);
    return response?.identifier ? new BearNote(response) : response;
  }

  // Open an existing note
  open(id, title, header, excludeTrashed = "yes", newWindow = "no", float = "no", showWindow = "yes", openNote = "yes") {
    let params = {
      exclude_trashed: excludeTrashed,
      new_window: newWindow,
      float: float,
      show_window: showWindow,
      open_note: openNote
    };

    if (id) {
      params["id"] = id;
    } else if (title) {
      params["title"] = title;
    } else {
      return this.#displayErrorMessage("Either id or title is required!");
    }

    if (header) params["header"] = header;

    return this.#openCallback("open-note", params, false);
  }

  // Search for notes
  search(term, tag, token) {
    let params = {};
    if (term) params["term"] = term;
    if (tag) params["tag"] = tag;
    if (token) params["token"] = token;

    const response = this.#openCallback("search", params);

    if (response?.notes) {
      try {
        const notesData = JSON.parse(response.notes);
        return notesData.map(noteData => new BearNote({ note: JSON.stringify(noteData) }));
      } catch (e) {
        return response;
      }
    }

    return response;
  }

  // Grab note content
  grabUrl(id, title, images = "no") {
    let params = { images: images };

    if (id) {
      params["id"] = id;
    } else if (title) {
      params["title"] = title;
    } else {
      return this.#displayErrorMessage("Either id or title is required!");
    }

    const response = this.#openCallback("grab-url", params);
    return response?.note ? new BearNote(response) : response;
  }

  // Move a note to trash
  trash(id) {
    if (!id) return this.#displayErrorMessage("Note id is required!");

    const params = { id: id };
    return this.#openCallback("trash", params);
  }

  // Archive a note
  archive(id) {
    if (!id) return this.#displayErrorMessage("Note id is required!");

    const params = { id: id };
    return this.#openCallback("archive", params);
  }

  // Unarchive a note
  unarchive(id) {
    if (!id) return this.#displayErrorMessage("Note id is required!");

    const params = { id: id };
    return this.#openCallback("unarchive", params);
  }

  // Get all tags
  tags(token) {
    let params = {};
    if (token) params["token"] = token;

    const response = this.#openCallback("tags", params);

    if (response?.tags) {
      try {
        return JSON.parse(response.tags);
      } catch (e) {
        return response.tags;
      }
    }

    return response;
  }

  // Change theme
  changeTheme(theme) {
    if (!theme) return this.#displayErrorMessage("Theme name is required!");

    const params = { theme: theme };
    return this.#openCallback("change-theme", params, false);
  }

  // Change font
  changeFont(font) {
    if (!font) return this.#displayErrorMessage("Font name is required!");

    const params = { font: font };
    return this.#openCallback("change-font", params, false);
  }

  // Add file to note
  addFile(id, title, file, filename, mode = "append", openNote = "no") {
    if (!file) return this.#displayErrorMessage("File path is required!");

    let params = {
      file: file,
      mode: mode,
      open_note: openNote
    };

    if (filename) params["filename"] = filename;

    if (id) {
      params["id"] = id;
    } else if (title) {
      params["title"] = title;
    } else {
      return this.#displayErrorMessage("Either id or title is required!");
    }

    const response = this.#openCallback("add-file", params);
    return response?.identifier ? new BearNote(response) : response;
  }

  // ***********
  // Private Functions
  // ***********

  #openURL(callbackAction, params = {}) {
    const queryString = Object.keys(params)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
      )
      .join("&");
    const url = `${this.callbackURL}${callbackAction}?${queryString}`;

    const success = app.openURL(url);
    if (this.#debug) this.#logResponse(callbackAction, params, success);
    return success;
  }

  // Open this.callbackURL
  #openCallback(callbackAction, params = {}, waitForResponse = true) {
    this.#errorCode = undefined;
    this.#errorMessage = undefined;

    // open and wait for result
    let cb = CallbackURL.create();
    cb.waitForResponse = waitForResponse;
    cb.baseURL = `${this.callbackURL}${callbackAction}`;
    Object.entries(params).forEach(([key, value]) =>
      cb.addParameter(key, value)
    );

    const success = cb.open();
    const response = cb.callbackResponse;

    if (this.#debug)
      this.#logResponse(callbackAction, params, success, response);
    if (response?.error != undefined) return this.#processError(response);

    return response;
  }

  #processError(response) {
    const errorMessage = response.error || "Unknown error occurred";

    this.#errorCode = 1;
    this.#errorMessage = errorMessage;
    this.#displayErrorMessage(`Bear Error - ${errorMessage}`);

    return undefined;
  }

  #logResponse(callbackAction, params, success, response = {}) {
    let message = "\n-------\nAction ";
    const successMessage = `${callbackAction}, ran successfully.`;
    const errorMessage = `${callbackAction}, failed.\nError: ${response["error"]}`;
    message = success ? message + successMessage : message + errorMessage;

    console.log(message);
    console.log(`Params: ${JSON.stringify(params)}\n`);
    if (response) console.log(`Response: ${JSON.stringify(response)}`);
  }

  #displayErrorMessage(message) {
    app.displayErrorMessage(message);
    context.cancel();
    return false;
  }

  #displayInfoMessage(message) {
    app.displayInfoMessage(message);
    context.cancel();
    return false;
  }

  #continueWithWarning(message, details) {
    app.displayWarningMessage(message);
    if (this.#debug) console.log(`******* Warning *******\n${details}`);
  }

  // Helper method that throws an alert displaying the variable passed to it
  #debugVariable(value) {
    alert(JSON.stringify(value));
  }
}

class BearNote {
  #data;

  constructor(data) {
    // Bear returns data in different formats depending on the API call
    if (typeof data === 'string') {
      try {
        this.#data = JSON.parse(data);
      } catch (e) {
        this.#data = { raw: data };
      }
    } else if (data.note) {
      // For grab-url and search responses
      try {
        this.#data = JSON.parse(data.note);
      } catch (e) {
        this.#data = data;
      }
    } else {
      this.#data = data;
    }
  }

  static create(data) {
    return new BearNote(data);
  }

  get identifier() {
    return this.#data?.identifier;
  }

  get title() {
    return this.#data?.title;
  }

  get tags() {
    return this.#data?.tags || [];
  }

  get modificationDate() {
    return this.#data?.modificationDate;
  }

  get creationDate() {
    return this.#data?.creationDate;
  }

  get isPinned() {
    return this.#data?.pin === "yes";
  }

  get isArchived() {
    return this.#data?.isArchived;
  }

  get isTrashed() {
    return this.#data?.isTrashed;
  }

  get text() {
    return this.#data?.text;
  }

  hasTag(tag) {
    if (!this.tags || this.tags.length === 0) return false;

    const normalizedTag = tag.toLowerCase().replace(/^#/, '');
    return this.tags.some(t =>
      t.toLowerCase().replace(/^#/, '') === normalizedTag
    );
  }
}

// ***********
// * Utility Functions (preserved from original bear.js)
// ***********

function bearTags(d = draft) {
  let tags = d.tags;

  tags.forEach((tag, index) => {
    const endText = /\s/.test(tag) ? "#" : "";
    tags[index] = `#${capitalizeTag(tag)}${endText}`;
  });
  tags.push("#_inbox");

  d.setTemplateTag("bearTags", tags.join(" "));
}

function updateWikiLinks(d = draft) {
  d.content = d.content.replace(/\[\[bear:/g, "[[");
  d.update();
}

function capitalizeTag(tag) {
  return tag.replace(/(?:^|\s|["'([{])+\S/g, (match) => match.toUpperCase());
}