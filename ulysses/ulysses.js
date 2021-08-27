// A simple interface for Drafts to interact with the Ulysses writing app
// Written against Ulysses API v2.8 and later
// https://ulysses.app/kb/x-callback-url
class Ulysses {
  constructor() {
    this.callbackURL = "ulysses://x-callback-url/";
    this.targetID = "";
  }

  // *******
  // Ulysses API Functions
  // *******

  // Create a new sheet in Ulysses
  newSheet(sheetText, groupID, format = "markdown", index) {
    // callback Params
    // TO DO: format and index NOT implemented yet
    var params = {
      group: groupID,
      text: sheetText,
    };
    var response = this._openCallback("new-sheet", params);
    this.targetID = response.targetId;
  }

  // Creates a new group.
  newGroup(name, parents, index) {
    // TO DO:
  }

  // Inserts or appends text to a sheet.
  insert(id, text, format, position, newline) {
    // TO DO:
  }

  // Creates a new note attachment on a sheet.
  attachNote(id, text, format) {
    var params = {
      id: this.targetID,
      text: HTML.escape(text),
    };
    var response = this._openCallback("attach-note", params, false);
  }

  // Changes an existing note attachment on a sheet.
  // Requires authorization.
  updateNote(id, text, index, format) {
    // TO DO:
  }

  // Removes a note attachment from a sheet.
  // Requires authorization.
  removeNote(id, index) {
    // TO DO:
  }

  // Creates a new image attachment on a sheet.
  // Image data must use base64 encoding.
  attachImage(id, image, format, filename) {
    // TO DO:
  }

  // Attach keyword(s) to a sheet in Ulysses
  // Requires an identifier to specify which sheet to attach keywords
  // Default identifier is set when new sheet is created.
  attachKeywords(keywords, targetID = this.targetID) {
    // A targetID is needed to attach keywords
    // If a targetID has not been set callback will not work
    if (targetID) {
      var params = {
        id: targetID,
        keywords: keywords,
      };
      this._openCallback("attach-keywords", params);
    } else {
      app.displayErrorMessage("TargetID missing!");
    }
  }

  // Removes one or more keywords from a sheet.
  // Requires authorization.
  removeKeywords(id, keywords) {
    // TO DO:
  }

  // Changes the title of a group.
  // Requires authorization.
  setGroupTitle(group, title) {
    // TO DO:
  }

  // Changes the first paragraph of a sheet.
  // Requires authorization.
  setSheetTitle(targetID, title, type) {
    // TO DO:
  }

  // Moves an item (sheet or group) to a target group and/or to a new position.
  // Requires authorization.
  move(id, targetGroup, index) {
    // TO DO:
  }

  // Copies an item (sheet or group) to a target group and/or to a new position.
  copy(id, targetGroup, index) {
    // TO DO:
  }

  // Moves an item (sheet or group) to the trash.
  // Requires authorization.
  trash(targetID) {
    this._openCallback("trash", { id: targetID });
  }

  // Retrieves information about an item (sheet or group).
  // Requires authorization.
  getItem(id, recursive) {
    // TO DO:
  }

  // Retrieves information about the root sections. Can be used to get a full listing of the entire Ulysses library.
  // Requires authorization.
  getRootItems(recursive) {
    // TO DO:
  }

  // Retrieves the contents (text, notes, keywords) of a sheet.
  // Requires authorization.
  readSheet(id, text) {
    // TO DO:
  }

  // Gets the QuickLook URL for a sheet. This is the sheet’s location on the file system.
  // Only available in Ulysses for Mac.
  getQuickLookUrl(id) {
    // TO DO:
  }

  // Opens an item (sheet or group) with a particular identifier in Ulysses.
  open(targetID = this.targetID) {
    this._openCallback("open", { id: targetID }, false);
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
    // TO DO:
  }

  // *******
  // Draft Specific Functions
  // *******

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

  //Authorize Drafts with Ulysses and save credentials
  _authorize() {}

  // Open this.callbackURL
  _openCallback(
    callbackAction,
    params = {},
    waitForResponse = true,
    message = " was a sucess!"
  ) {
    // open and wait for result
    var cb = CallbackURL.create();
    cb.waitForResponse = waitForResponse;
    cb.baseURL = this.callbackURL + callbackAction;
    for (const [key, value] of Object.entries(params)) {
      cb.addParameter(key, value);
    }
    var success = cb.open();
    var response = cb.callbackResponse;
    console.log(JSON.stringify(response));
    if (success) {
      console.log(callbackAction + message);
    } else {
      // something went wrong or was cancelled
      var message =
        "Error " + response["errorCode"] + ": " + response["errorMessage"];
      console.log(response);
      app.displayErrorMessage(message);
      context.fail();
    }
    return response;
  }
}
