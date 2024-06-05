// Ulysses.js by Nelson/Roberto (@dewittn)
// A simple interface for Drafts to interact with the Ulysses writing app
// Written against Ulysses API v2.8 and later
// https://ulysses.app/kb/x-callback-url
class Ulysses {
  static callbackURL = "ulysses://x-callback-url/";
  #debug = false;
  #errorCode;
  #errorMessage;

  constructor() {}

  static create() {
    return new Ulysses();
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
    if (this.#textFormatCheck(textFormat)) params["format"] = textFormat;
    if (this.#indexCheck(index)) params["index"] = index;

    // Ulysses should return a sheet that has the new target ID
    const response = this.#openCallback("new-sheet", params);

    return new UlyssesSheet(response.sheet);
  }

  // Creates a new group.
  newGroup(name, parent, index) {
    let params = { name: name };
    if (parent) params["parent"] = parent;
    if (this.#indexCheck(index)) params["index"] = index;

    return this.#openCallback("new-group", params);
  }

  // Inserts or appends text to a sheet.
  insert(id, text, textFormat, position, newline) {
    if (!id) return this.#displayErrorMessage("TargetID missing!");

    let params = {
      id: id,
      text: text,
    };
    if (this.#textFormatCheck(textFormat)) params["format"] = textFormat;
    if (this.#potisionCheck(position)) params["position"] = position;
    if (this.#newlineCheck(newline)) params["newline"] = newline;

    return this.#openCallback("insert", params);
  }

  // Creates a new note attachment on a sheet.
  attachNote(id, text, textFormat = "markdown") {
    if (!this.#typeCheckString(id, "attachNote")) return;

    let params = {
      id: id,
      text: text,
    };
    if (this.#textFormatCheck(textFormat)) params["format"] = textFormat;

    return this.#openCallback("attach-note", params, false);
  }

  // Changes an existing note attachment on a sheet.
  // Requires authorization.
  updateNote(id, text, index, textFormat) {
    if (!this.#typeCheckString(id, "updateNote")) return;

    this.#authorize();
    let params = {
      id: id,
      text: text,
      "access-token": this.accessToken,
    };
    if (this.#textFormatCheck(textFormat)) params["format"] = textFormat;
    if (this.#indexCheck(index)) params["index"] = index;

    return this.#openCallback("update-note", params, false);
  }

  // Removes a note attachment from a sheet.
  // Requires authorization.
  removeNote(id, index) {
    if (!this.#typeCheckString(id, "removeNote")) return;

    this.#authorize();
    let params = {
      id: id,
      "access-token": this.accessToken,
    };
    if (this.#indexCheck(index)) params["index"] = index;

    return this.#openCallback("remove-note", params, false);
  }

  // Creates a new image attachment on a sheet.
  // Image data must use base64 encoding.
  attachImage(id, image, imageFormat, filename) {
    if (!this.#typeCheckString(id, "attachImage")) return;

    let params = {
      id: id,
      image: HTML.escape(image),
      filename: filename,
    };
    if (this.#imageFormatCheck(imageFormat)) params["format"] = imageFormat;

    return this.#openCallback("attach-image", params, false);
  }

  // Attach keyword(s) to a sheet in Ulysses
  // Requires an identifier to specify which sheet to attach keywords
  // Default identifier is set when new sheet is created.
  attachKeywords(id, keywords) {
    if (!this.#typeCheckString(id, "attachKeywords")) return;

    const params = {
      id: id,
      keywords: keywords,
    };

    return this.#openCallback("attach-keywords", params);
  }

  // Removes one or more keywords from a sheet.
  // Requires authorization.
  removeKeywords(id, keywords) {
    if (!this.#typeCheckString(id, "removeKeywords")) return;

    this.#authorize();
    const params = {
      id: id,
      keywords: keywords,
      "access-token": this.accessToken,
    };

    return this.#openCallback("remove-keywords", params);
  }

  // Changes the title of a group.
  // Requires authorization.
  setGroupTitle(group, title) {
    if (!this.#typeCheckString(group, "setGroupTitle")) return;

    this.#authorize();
    const params = {
      group: group,
      title: title,
      "access-token": this.accessToken,
    };

    return this.#openCallback("set-group-title", params);
  }

  // Changes the first paragraph of a sheet.
  // Requires authorization.
  setSheetTitle(id, title, type) {
    if (!this.#typeCheckString(id, "setSheetTitle")) return;

    this.#authorize();
    let params = {
      id: id,
      title: title,
      "access-token": this.accessToken,
    };
    if (this.#typeCheck(type)) params["type"] = type;

    return this.#openCallback("set-sheet-title", params);
  }

  // Moves an item (sheet or group) to a target group and/or to a new position.
  // Requires authorization.
  move(id, targetGroup, index) {
    if (!this.#typeCheckString(id, "move")) return;

    this.#authorize();
    let params = {
      id: id,
      targetGroup: targetGroup,
      "access-token": this.accessToken,
    };
    if (this.#indexCheck(index)) params["index"] = index;

    return this.#openCallback("move", params);
  }

  // Copies an item (sheet or group) to a target group and/or to a new position.
  copy(id, targetGroup, index) {
    if (!this.#typeCheckString(id, "copy")) return;

    let params = {
      id: id,
      targetGroup: targetGroup,
    };
    if (this.#indexCheck(index)) params["index"] = index;

    return this.#openCallback("copy", params);
  }

  // Moves an item (sheet or group) to the trash.
  // Requires authorization.
  trash(id) {
    if (!this.#typeCheckString(id, "trash")) return;

    this.#authorize();
    const params = {
      id: id,
      "access-token": this.accessToken,
    };

    return this.#openCallback("trash", params);
  }

  // Retrieves information about an item (sheet or group).
  // Requires authorization.
  getItem(id, recursive = "Yes") {
    if (!this.#typeCheckString(id, "getItem")) return;

    this.#authorize();
    const params = {
      id: id,
      recursive: recursive,
      "access-token": this.accessToken,
    };

    const response = this.#openCallback("get-item", params);
    return response?.item ? JSON.parse(response.item) : response;
  }

  // Retrieves information about the root sections. Can be used to get a full listing of the entire Ulysses library.
  // Requires authorization.
  getRootItems(recursive = "No") {
    this.#authorize();
    const params = {
      recursive: recursive,
      "access-token": this.accessToken,
    };

    const response = this.#openCallback("get-root-items", params);
    return response?.items ? JSON.parse(response.items) : response;
  }

  // Retrieves the contents (text, notes, keywords) of a sheet.
  // Requires authorization.
  readSheet(id, text = "No") {
    if (!this.#typeCheckString(id, "readSheet")) return;

    this.#authorize();
    const params = {
      id: id,
      text: text,
      "access-token": this.accessToken,
    };

    const response = this.#openCallback("read-sheet", params);

    return response?.sheet ? new UlyssesSheet(response.sheet) : response;
  }

  // Gets the QuickLook URL for a sheet. This is the sheet’s location on the file system.
  // Only available in Ulysses for Mac.
  getQuickLookUrl(id) {
    if (!id) return this.#displayErrorMessage("TargetID missing!");

    const model = device.model;
    if (model != "Mac") return;

    const params = {
      id: id,
    };

    const response = this.#openCallback("get-quick-look-url", params);
    return response?.url ? JSON.parse(response.url) : response;
  }

  // Opens an item (sheet or group) with a particular identifier in Ulysses.
  open(id) {
    if (!id) return this.#displayErrorMessage("TargetID missing!");
    return this.#openURL("open", { id: id }, false);
  }

  // Opens the special groups “All”
  openAll() {
    this.#openCallback("open-all", {}, false);
  }

  // Opens the special groups “Last 7 Days”
  openRecent() {
    this.#openCallback("open-recent", {}, false);
  }

  // Opens the special groups “Favorites”
  openFavorites() {
    this.#openCallback("open-favorites", {}, false);
  }

  // Retrieves the build number of Ulysses, and the version of Ulysses’ X-Callback API.
  getVersion() {
    return this.#openCallback("get-version");
  }

  // ***********
  // Private Functions
  // ***********

  // Expects string, Returns true or false
  #textFormatCheck(textFormat) {
    if (!this.#typeCheckString(textFormat, "#textFormatCheck")) return false;
    return textFormat.match(/^(markdown|text|html)$/);
  }

  // Expects int, Returns true or false
  #indexCheck(index) {
    return Number.isInteger(index);
  }

  // Expects string, Returns true or false
  #potisionCheck(potision) {
    if (!this.#typeCheckString(potision, "#potisionCheck")) return false;
    if (potision) return potision.match(/^(begin|end)$/);
  }

  // Expects string, Returns true or false
  #newlineCheck(newLine) {
    if (!this.#typeCheckString(newLine, "#newlineCheck")) return false;
    if (newLine) return newLine.match(/^(prepend|append|enclose)$/);
  }

  // Expects string, Returns true or false
  #typeCheck(type) {
    if (!this.#typeCheckString(type, "#typeCheck")) return false;
    if (type) return type.match(/^(heading[1-6]|comment|filename)$/);
  }

  #imageFormatCheck(imageFormat) {
    if (!this.#typeCheckString(imageFormat, "#imageFormatCheck")) return false;
    if (imageFormat) return imageFormat.match(/^(png|pdf|jpg|raw|gif)$/);
  }

  //Authorize Drafts with Ulysses and save credentials
  #authorize() {
    const model = device.model;
    const credential = Credential.create(`Ulysses (${model})`, "Ulysses API");
    credential.addPasswordField("access-token", "Access Token");
    this.accessToken = credential.getValue("access-token");
    if (this.accessToken) return;

    const response = this.#openCallback("authorize", {
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

  #openURL(callbackAction, params = {}) {
    const queryString = Object.keys(params)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join("&");
    const url = `${this.callbackURL}${callbackAction}?${queryString}`;

    const success = app.openURL(url);
    if (this.#debug) this.#logResponse(callbackAction, params, success);
    return success;
  }

  // Open this.callbackURL
  #openCallback(callbackAction, params = {}, waitForResponse = true) {
    this.#errorCode == undefined;

    // open and wait for result
    let cb = CallbackURL.create();
    cb.waitForResponse = waitForResponse;
    cb.baseURL = `${this.callbackURL}${callbackAction}`;
    Object.entries(params).forEach(([key, value]) => cb.addParameter(key, value));

    const success = cb.open();
    const response = cb.callbackResponse;

    if (this.#debug) this.#logResponse(callbackAction, params, success, response);
    if (response?.errorCode != undefined) return this.#processError(response);

    return response;
  }

  #processError(response) {
    const { errorCode, errorMessage } = response;

    this.#errorCode = errorCode;
    this.#errorMessage = errorMessage;
    this.#displayErrorMessage(`Ulysses Error ${errorCode} - ${errorMessage}`);

    return undefined;
  }

  #logResponse(callbackAction, params, success, response = {}) {
    let message = "\n-------\nAction ";
    const successMessage = `${callbackAction}, ran successfully.`;
    const errorMessage = `${callbackAction}, failed.\nError ${response["errorCode"]}: ${response["errorMessage"]}`;
    message = success ? message + successMessage : message + errorMessage;

    console.log(message);
    console.log(`Params: ${JSON.stringify(params)}\n`);
    if (response) console.log(`Repsonse: ${JSON.stringify(response)}`);
  }

  #typeCheckString(variable, location) {
    const varType = Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
    if (varType == "string") return true;
    this.#continueWithWarning(
      `Ulysses-v2.js, ${location}: Incorret or missing value!`,
      `Type mismatch: Ulysses-v2.js, ${location}\nExpected type 'string', got '${varType}' instead.`
    );
    return false;
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

class UlyssesSheet {
  #data;

  constructor(data) {
    this.#data = JSON.parse(data);
  }

  static create(data) {
    return new UlyssesSheet(data);
  }

  get notes() {
    return this.#data?.notes;
  }

  get title() {
    return this.#data?.title;
  }

  get isMaterial() {
    return this.#data?.isMaterial;
  }

  get keywords() {
    return this.#data?.keywords;
  }

  get identifier() {
    return this.#data?.identifier;
  }

  get groupName() {
    return this.#data?.groupName;
  }

  get groupID() {
    return this.#data?.groupID;
  }

  get changeToken() {
    return this.#data?.changeToken;
  }

  hasKeyword(dest) {
    const index = this.keywords.findIndex((keyword) => {
      return keyword.toLowerCase() === dest.toLowerCase();
    });

    return index != -1;
  }
}
