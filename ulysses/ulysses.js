// A simple interface for Drafts to interact with the Ulysses writing app
// Written against Ulysses API v2.8 and later
// https://ulysses.app/kb/x-callback-url
class Ulysses {
  constructor() {
    this._callbackURL = "ulysses://x-callback-url/";
    this._targetID = "";
    this._debug = false;
  }

  static create() {
    return new Ulysses();
  }

  // ***********
  // * Class Properties
  // ***********

  get targetId() {
    return this._targetID;
  }

  set targetId(id) {
    if (typeof id === "string") {
      this._targetID = id;
    } else {
      app.displayErrorMessage("Error: targetID must be a string.");
      context.cancel();
    }
  }

  get debug() {
    return this._debug;
  }

  set debug(state) {
    if (typeof state === "boolean") {
      this._debug = state;
    } else {
      app.displayErrorMessage("Error: debug can only be set to true or false.");
      context.cancel();
    }
  }

  // ***********
  // * Ulysses API Functions
  // ***********

  // Create a new sheet in Ulysses
  newSheet(text, group, format = "markdown", index) {
    // callback Params
    var params = {
      // text: HTML.escape(text),
      text: text,
      group: group,
    };
    if (this._formatCheck(format)) {
      params["format"] = format;
    }
    if (this._indexCheck(index)) {
      params["index"] = index;
    }
    var response = this._openCallback("new-sheet", params);
    this._targetID = response.targetId;
    return response;
  }

  // Creates a new group.
  newGroup(name, parent, index) {
    var params = { name: name };
    if (parent) {
      params["parent"] = parent;
    }
    if (this._indexCheck(index)) {
      params["index"] = index;
    }
    var response = this._openCallback("new-group", params);
    this._targetID = response.targetId;
    return response;
  }

  // Inserts or appends text to a sheet.
  insert(id, text, format, position, newline) {
    var params = {
      id: id,
      // text: HTML.escape(text),
      text: text,
    };
    if (this._formatCheck(format)) {
      params["format"] = format;
    }
    if (this._potisionCheck(position)) {
      params["position"] = position;
    }
    if (this._newlineCheck(newline)) {
      params["newline"] = newline;
    }
    this._openCallback("insert", params);
  }

  // Creates a new note attachment on a sheet.
  attachNote(text, id = this._targetID, format) {
    var params = {
      id: id,
      // text: HTML.escape(text),
      text: text,
    };
    if (this._formatCheck(format)) {
      params["format"] = format;
    }
    var response = this._openCallback("attach-note", params, false);
  }

  // Changes an existing note attachment on a sheet.
  // Requires authorization.
  updateNote(id, text, index, format) {
    this._authorize();
    var params = {
      id: id,
      // text: HTML.escape(text),
      text: text,
      "access-token": this.accessToken,
    };
    if (this._formatCheck(format)) {
      params["format"] = format;
    }
    if (this._indexCheck(index)) {
      params["index"] = index;
    }
    var response = this._openCallback("update-note", params, false);
  }

  // Removes a note attachment from a sheet.
  // Requires authorization.
  removeNote(id, index) {
    this._authorize();
    var params = {
      id: id,
      "access-token": this.accessToken,
    };
    if (this._indexCheck(index)) {
      params["index"] = index;
    }
    this._openCallback("remove-note", params, false);
  }

  // Creates a new image attachment on a sheet.
  // Image data must use base64 encoding.
  attachImage(id, image, format, filename) {
    var params = {
      id: id,
      image: HTML.escape(image),
      filename: filename,
    };
    if (this._formatCheck(format)) {
      params["format"] = format;
    }
    this._openCallback("attach-image", params, false);
  }

  // Attach keyword(s) to a sheet in Ulysses
  // Requires an identifier to specify which sheet to attach keywords
  // Default identifier is set when new sheet is created.
  attachKeywords(keywords, id = this._targetID) {
    // A targetID is needed to attach keywords
    // If a targetID has not been set callback will not work
    let response = false;
    if (id) {
      var params = {
        id: id,
        keywords: keywords,
      };
      response = this._openCallback("attach-keywords", params);
    } else {
      app.displayErrorMessage("TargetID missing!");
    }
    return response;
  }

  // Removes one or more keywords from a sheet.
  // Requires authorization.
  removeKeywords(id, keywords) {
    let response = false;
    this._authorize();
    if (id) {
      var params = {
        id: id,
        keywords: keywords,
        "access-token": this.accessToken,
      };
      response = this._openCallback("remove-keywords", params);
    } else {
      app.displayErrorMessage("TargetID missing!");
    }
    return response;
  }

  // Changes the title of a group.
  // Requires authorization.
  setGroupTitle(group, title) {
    this._authorize();
    var params = {
      group: group,
      title: HTML.escape(title),
      "access-token": this.accessToken,
    };
    this._openCallback("set-group-title", params);
  }

  // Changes the first paragraph of a sheet.
  // Requires authorization.
  setSheetTitle(id, title, type) {
    this._authorize();
    var params = {
      id: id,
      title: HTML.escape(title),
      "access-token": this.accessToken,
    };
    if (this._typeCheck(type)) {
      params["type"] = type;
    }
    this._openCallback("set-sheet-title", params);
  }

  // Moves an item (sheet or group) to a target group and/or to a new position.
  // Requires authorization.
  move(id, targetGroup, index) {
    this._authorize();
    if (id) {
      var params = {
        id: id,
        targetGroup: targetGroup,
        "access-token": this.accessToken,
      };
      if (this._indexCheck(index)) {
        params["index"] = index;
      }
      this._openCallback("copy", params);
    } else {
      app.displayErrorMessage("TargetID missing!");
    }
  }

  // Copies an item (sheet or group) to a target group and/or to a new position.
  copy(id, targetGroup, index) {
    if (id) {
      var params = {
        id: id,
        targetGroup: targetGroup,
      };
      if (this._indexCheck(index)) {
        params["index"] = index;
      }
      this._openCallback("copy", params);
    } else {
      app.displayErrorMessage("TargetID missing!");
    }
  }

  // Moves an item (sheet or group) to the trash.
  // Requires authorization.
  trash(id) {
    this._authorize();
    this._openCallback("trash", {
      id: id,
      "access-token": this.accessToken,
    });
  }

  // Retrieves information about an item (sheet or group).
  // Requires authorization.
  getItem(id, recursive = "Yes") {
    this._authorize();
    if (id) {
      var params = {
        id: id,
        recursive: recursive,
        "access-token": this.accessToken,
      };
      var response = this._openCallback("get-item", params);
      return JSON.parse(response.item);
    } else {
      app.displayErrorMessage("TargetID missing!");
    }
  }

  // Retrieves information about the root sections. Can be used to get a full listing of the entire Ulysses library.
  // Requires authorization.
  getRootItems(recursive = "Yes") {
    this._authorize();
    var params = {
      recursive: recursive,
      "access-token": this.accessToken,
    };
    var response = this._openCallback("get-root-items", params);
    console.log(response);
    return JSON.parse(response.items);
  }

  // Retrieves the contents (text, notes, keywords) of a sheet.
  // Requires authorization.
  readSheet(id, text = "No") {
    this._authorize();
    if (id) {
      var params = {
        id: id,
        text: text,
        "access-token": this.accessToken,
      };
      var response = this._openCallback("read-sheet", params);
      return JSON.parse(response.sheet);
    } else {
      app.displayErrorMessage("TargetID missing!");
    }
  }

  // Gets the QuickLook URL for a sheet. This is the sheet’s location on the file system.
  // Only available in Ulysses for Mac.
  getQuickLookUrl(id) {
    var model = device.model;
    if (model == "Mac") {
      if (id) {
        var params = {
          id: id,
        };
        var response = this._openCallback("get-quick-look-url", params);
        return response.url;
      } else {
        app.displayErrorMessage("TargetID missing!");
      }
    }
  }

  // Opens an item (sheet or group) with a particular identifier in Ulysses.
  open(id = this._targetID) {
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
        array[index] = tag.replace(/\w\S*/g, (w) =>
          w.replace(/^\w/, (c) => c.toUpperCase())
        );
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

  _formatCheck(f) {
    if (f) {
      return f.match(/^(markdown|text|html)$/);
    }
  }

  _indexCheck(i) {
    return Number.isInteger(i);
  }

  _potisionCheck(p) {
    if (p) {
      return p.match(/^(begin|end)$/);
    }
  }

  _newlineCheck(n) {
    if (n) {
      return n.match(/^(prepend|append|enclose)$/);
    }
  }

  _typeCheck(t) {
    if (t) {
      return t.match(/^(heading[1-6]|comment|filename)$/);
    }
  }

  _formatCheck(f) {
    if (f) {
      return f.match(/^(png|pdf|jpg|raw|gif)$/);
    }
  }

  //Authorize Drafts with Ulysses and save credentials
  _authorize() {
    var model = device.model;
    var credential = Credential.create(
      "Ulysses (" + model + ")",
      "Ulysses API"
    );
    credential.addPasswordField("access-token", "Access Token");
    this.accessToken = credential.getValue("access-token");
    if (!this.accessToken) {
      var response = this._openCallback("authorize", {
        appname: "Drafts App (" + model + ")",
      });
      var token = response["access-token"];
      app.setClipboard(token);
      alert(
        "Your Ulysses access token for this devive (" +
          model +
          ") has been copied to the clipboard.\n\n Please paste it into the text field on the next window."
      );
      credential.authorize();
      app.setClipboard("");
      this.accessToken = credential.getValue("access-token");
    }
  }

  _openURL(callbackAction, params = {}) {
    var message = "\n-------\nAction ";
    const queryString = Object.keys(params)
      .map(
        (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
      )
      .join("&");
    var url = this._callbackURL + callbackAction + "?" + queryString;
    var success = app.openURL(url);
    if (success) {
      message = message + callbackAction + ", ran successfully.";
    } else {
      // something went wrong or was cancelled
      message =
        message +
        callbackAction +
        ", failed.\n" +
        "Error " +
        response["errorCode"] +
        ": " +
        response["errorMessage"];
      app.displayErrorMessage(message);
      context.fail();
    }
    if (this._debug) {
      console.log(message);
      console.log("Params: " + JSON.stringify(params));
    }
  }

  // Open this._callbackURL
  _openCallback(callbackAction, params = {}, waitForResponse = true) {
    // open and wait for result
    let message = "\n-------\nAction ";
    let cb = CallbackURL.create();
    cb.waitForResponse = waitForResponse;
    cb.baseURL = this._callbackURL + callbackAction;
    for (const [key, value] of Object.entries(params)) {
      cb.addParameter(key, value);
    }
    let success = cb.open();
    let response = cb.callbackResponse;
    if (success) {
      message = message + callbackAction + ", ran successfully.";
    } else {
      // something went wrong or was cancelled
      message =
        message +
        callbackAction +
        ", failed.\n" +
        "Error " +
        response["errorCode"] +
        ": " +
        response["errorMessage"];
      app.displayErrorMessage(message);
      context.fail();
    }
    if (this._debug) {
      console.log(message);
      console.log("Params: " + JSON.stringify(params));
      console.log("Repsonse: " + JSON.stringify(response));
    }
    return response;
  }
}
