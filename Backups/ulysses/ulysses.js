// Ulysses.js by Nelson/Roberto (@dewittn)
// A simple interface for Drafts to interact with the Ulysses writing app
// Written against Ulysses API v2.8 and later
// https://ulysses.app/kb/x-callback-url
class Ulysses {
  constructor() {
    this._callbackURL = "ulysses://x-callback-url/";
    this._debug = false;
  }

  static create() {
    return new Ulysses();
  }

  // ***********
  // * Class Properties
  // ***********

  get debug() {
    return this._debug;
  }

  set debug(state) {
    if (state == false) return;

    this._debug = true;
  }

  // ***********
  // * Ulysses API Functions
  // ***********

  // Create a new sheet in Ulysses
  newSheet(text, group, textFormat = "markdown", index) {
    // callback Params
    let params = {
      text: text,
      group: group,
    };
    if (this._textFormatCheck(textFormat)) params["format"] = textFormat;
    if (this._indexCheck(index)) params["index"] = index;

    return this._openCallback("new-sheet", params);
  }

  // Creates a new group.
  newGroup(name, parent, index) {
    let params = { name: name };
    if (parent) params["parent"] = parent;
    if (this._indexCheck(index)) params["index"] = index;

    return this._openCallback("new-group", params);
  }

  // Inserts or appends text to a sheet.
  insert(id, text, textFormat, position, newline) {
    if (!id) return this._displayErrorMessage("TargetID missing!");

    let params = {
      id: id,
      text: text,
    };
    if (this._textFormatCheck(textFormat)) params["format"] = textFormat;
    if (this._potisionCheck(position)) params["position"] = position;
    if (this._newlineCheck(newline)) params["newline"] = newline;

    return this._openCallback("insert", params);
  }

  // Creates a new note attachment on a sheet.
  attachNote(id, text, textFormat = "markdown") {
    if (!this._typeCheckString(id, "attachNote")) return;

    let params = {
      id: id,
      text: text,
    };
    if (this._textFormatCheck(textFormat)) params["format"] = textFormat;

    return this._openCallback("attach-note", params, false);
  }

  // Changes an existing note attachment on a sheet.
  // Requires authorization.
  updateNote(id, text, index, textFormat) {
    if (!this._typeCheckString(id, "updateNote")) return;

    this._authorize();
    let params = {
      id: id,
      text: text,
      "access-token": this.accessToken,
    };
    if (this._textFormatCheck(textFormat)) params["format"] = textFormat;
    if (this._indexCheck(index)) params["index"] = index;

    return this._openCallback("update-note", params, false);
  }

  // Removes a note attachment from a sheet.
  // Requires authorization.
  removeNote(id, index) {
    if (!this._typeCheckString(id, "removeNote")) return;

    this._authorize();
    let params = {
      id: id,
      "access-token": this.accessToken,
    };
    if (this._indexCheck(index)) params["index"] = index;

    return this._openCallback("remove-note", params, false);
  }

  // Creates a new image attachment on a sheet.
  // Image data must use base64 encoding.
  attachImage(id, image, imageFormat, filename) {
    if (!this._typeCheckString(id, "attachImage")) return;

    let params = {
      id: id,
      image: HTML.escape(image),
      filename: filename,
    };
    if (this._imageFormatCheck(imageFormat)) params["format"] = imageFormat;

    return this._openCallback("attach-image", params, false);
  }

  // Attach keyword(s) to a sheet in Ulysses
  // Requires an identifier to specify which sheet to attach keywords
  // Default identifier is set when new sheet is created.
  attachKeywords(id, keywords) {
    if (!this._typeCheckString(id, "attachKeywords")) return;

    const params = {
      id: id,
      keywords: keywords,
    };

    return this._openCallback("attach-keywords", params);
  }

  // Removes one or more keywords from a sheet.
  // Requires authorization.
  removeKeywords(id, keywords) {
    if (!this._typeCheckString(id, "removeKeywords")) return;

    this._authorize();
    const params = {
      id: id,
      keywords: keywords,
      "access-token": this.accessToken,
    };

    return this._openCallback("remove-keywords", params);
  }

  // Changes the title of a group.
  // Requires authorization.
  setGroupTitle(group, title) {
    if (!this._typeCheckString(group, "setGroupTitle")) return;

    this._authorize();
    const params = {
      group: group,
      title: title,
      "access-token": this.accessToken,
    };

    return this._openCallback("set-group-title", params);
  }

  // Changes the first paragraph of a sheet.
  // Requires authorization.
  setSheetTitle(id, title, type) {
    if (!this._typeCheckString(id, "setSheetTitle")) return;

    this._authorize();
    let params = {
      id: id,
      title: title,
      "access-token": this.accessToken,
    };
    if (this._typeCheck(type)) params["type"] = type;

    return this._openCallback("set-sheet-title", params);
  }

  // Moves an item (sheet or group) to a target group and/or to a new position.
  // Requires authorization.
  move(id, targetGroup, index) {
    if (!this._typeCheckString(id, "move")) return;

    this._authorize();
    let params = {
      id: id,
      targetGroup: targetGroup,
      "access-token": this.accessToken,
    };
    if (this._indexCheck(index)) params["index"] = index;

    return this._openCallback("copy", params);
  }

  // Copies an item (sheet or group) to a target group and/or to a new position.
  copy(id, targetGroup, index) {
    if (!this._typeCheckString(id, "copy")) return;

    let params = {
      id: id,
      targetGroup: targetGroup,
    };
    if (this._indexCheck(index)) params["index"] = index;

    return this._openCallback("copy", params);
  }

  // Moves an item (sheet or group) to the trash.
  // Requires authorization.
  trash(id) {
    if (!this._typeCheckString(id, "trash")) return;

    this._authorize();
    const params = {
      id: id,
      "access-token": this.accessToken,
    };

    return this._openCallback("trash", params);
  }

  // Retrieves information about an item (sheet or group).
  // Requires authorization.
  getItem(id, recursive = "Yes") {
    if (!this._typeCheckString(id, "getItem")) return;

    this._authorize();
    const params = {
      id: id,
      recursive: recursive,
      "access-token": this.accessToken,
    };

    const response = this._openCallback("get-item", params);
    return response?.item ? JSON.parse(response.item) : response;
  }

  // Retrieves information about the root sections. Can be used to get a full listing of the entire Ulysses library.
  // Requires authorization.
  getRootItems(recursive = "Yes") {
    this._authorize();
    const params = {
      recursive: recursive,
      "access-token": this.accessToken,
    };

    const response = this._openCallback("get-root-items", params);
    return response?.items ? JSON.parse(response.items) : response;
  }

  // Retrieves the contents (text, notes, keywords) of a sheet.
  // Requires authorization.
  readSheet(id, text = "No") {
    if (!this._typeCheckString(id, "readSheet")) return;

    this._authorize();
    const params = {
      id: id,
      text: text,
      "access-token": this.accessToken,
    };

    const response = this._openCallback("read-sheet", params);
    return response?.sheet ? JSON.parse(response.sheet) : response;
  }

  // Gets the QuickLook URL for a sheet. This is the sheet’s location on the file system.
  // Only available in Ulysses for Mac.
  getQuickLookUrl(id) {
    if (!id) return this._displayErrorMessage("TargetID missing!");

    const model = device.model;
    if (model != "Mac") return;

    const params = {
      id: id,
    };

    const response = this._openCallback("get-quick-look-url", params);
    return response?.url ? JSON.parse(response.url) : response;
  }

  // Opens an item (sheet or group) with a particular identifier in Ulysses.
  open(id) {
    if (!id) return this._displayErrorMessage("TargetID missing!");
    this._openURL("open", { id: id }, false);
  }

  // Opens the special groups “All”
  openAll() {
    this._openCallback("open-all", {}, false);
  }

  // Opens the special groups “Last 7 Days”
  openRecent() {
    this._openCallback("open-recent", {}, false);
  }

  // Opens the special groups “Favorites”
  openFavorites() {
    this._openCallback("open-favorites", {}, false);
  }

  // Retrieves the build number of Ulysses, and the version of Ulysses’ X-Callback API.
  getVersion() {
    return this._openCallback("get-version");
  }

  // ***********
  // Draft Specific Functions
  // ***********

  // Optional Function that Capitalizes Draft tags
  // All draft tags are stored in lowercase so this
  capitalizeTags(tags) {
    if (tags.length > 0) {
      tags.forEach(function capitalize(tag, index, array) {
        array[index] = tag.replace(/\w\S*/g, (w) => w.replace(/^\w/, (c) => c.toUpperCase()));
      });
    }
    return tags;
  }

  // Converts MultiMakdown into Markdown XL
  convertMarkdown(content) {
    // Converts highlight tags `{==` and `==}` into `::`
    return content.replace(/\{==/g, "::").replace(/==\}/g, "::");
  }

  // ***********
  // "Private" Functions
  // ***********

  // Expects string, Returns true or false
  _textFormatCheck(textFormat) {
    if (!this._typeCheckString(textFormat, "_textFormatCheck")) return false;
    return textFormat.match(/^(markdown|text|html)$/);
  }

  // Expects int, Returns true or false
  _indexCheck(index) {
    return Number.isInteger(index);
  }

  // Expects string, Returns true or false
  _potisionCheck(potision) {
    if (!this._typeCheckString(potision, "_potisionCheck")) return false;
    if (potision) return potision.match(/^(begin|end)$/);
  }

  // Expects string, Returns true or false
  _newlineCheck(newLine) {
    if (!this._typeCheckString(newLine, "_newlineCheck")) return false;
    if (newLine) return newLine.match(/^(prepend|append|enclose)$/);
  }

  // Expects string, Returns true or false
  _typeCheck(type) {
    if (!this._typeCheckString(type, "_typeCheck")) return false;
    if (type) return type.match(/^(heading[1-6]|comment|filename)$/);
  }

  _imageFormatCheck(imageFormat) {
    if (!this._typeCheckString(imageFormat, "_imageFormatCheck")) return false;
    if (imageFormat) return imageFormat.match(/^(png|pdf|jpg|raw|gif)$/);
  }

  //Authorize Drafts with Ulysses and save credentials
  _authorize() {
    const model = device.model;
    let credential = Credential.create(`Ulysses (${model})`, "Ulysses API");
    credential.addPasswordField("access-token", "Access Token");
    this.accessToken = credential.getValue("access-token");
    if (this.accessToken) return;

    let response = this._openCallback("authorize", {
      appname: `Drafts App (${model})`,
    });
    app.setClipboard(response["access-token"]);
    alert(
      "Your Ulysses access token for this devive (" +
        model +
        ") has been copied to the clipboard.\n\n" +
        "Please paste it into the text field on the next window."
    );
    credential.authorize();
    app.setClipboard("");

    this.accessToken = credential.getValue("access-token");
  }

  _openURL(callbackAction, params = {}) {
    const queryString = Object.keys(params)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join("&");
    const url = `${this._callbackURL}${callbackAction}?${queryString}`;

    const success = app.openURL(url);
    if (this._debug) this._logResponse(callbackAction, params, success);
  }

  // Open this._callbackURL
  _openCallback(callbackAction, params = {}, waitForResponse = true) {
    // open and wait for result
    let cb = CallbackURL.create();
    cb.waitForResponse = waitForResponse;
    cb.baseURL = this._callbackURL + callbackAction;
    Object.entries(params).forEach(([key, value]) => cb.addParameter(key, value));

    const success = cb.open();
    const response = cb.callbackResponse;
    if (this._debug) this._logResponse(callbackAction, params, success, response);

    return response;
  }

  _logResponse(callbackAction, params, success, response = null) {
    let message = "\n-------\nAction ";
    const successMessage = `${callbackAction}, ran successfully.`;
    const errorMessage = `${callbackAction}, failed.\nError ${response["errorCode"]}: ${response["errorMessage"]}`;
    message = success ? message + successMessage : message + errorMessage;

    console.log(message);
    console.log(`Params: ${JSON.stringify(params)}\n`);
    if (response) console.log(`Repsonse: ${JSON.stringify(response)}`);
  }

  _typeCheckString(variable, location) {
    const varType = Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
    if (varType == "string") return true;
    this._continueWithWarning(
      `Ulysses-v2.js, ${location}: Incorret or missing value!`,
      `Type mismatch: Ulysses-v2.js, ${location}\nExpected type 'string', got '${varType}' instead.`
    );
    return false;
  }

  _displayErrorMessage(message) {
    app.displayErrorMessage(message);
    context.cancel();
    return false;
  }

  _displayInfoMessage(message) {
    app.displayInfoMessage(message);
    context.cancel();
    return false;
  }

  _continueWithWarning(message, details) {
    app.displayWarningMessage(message);
    if (this._debug) console.log(`******* Warning *******\n${details}`);
  }

  // Helper method that throws an alert displaying the variable passed to it
  _debugVariable(value) {
    alert(JSON.stringify(value));
  }
}
