// A simple interface for Drafts to interact with the Ulysses writing app
// ulysses://x-callback-url/new-sheet?text=[[draft]]&group=[[groupID]]
class Ulysses {
  constructor() {
    this.callbackURL = "ulysses://x-callback-url/";
    this.targetID = "";
  }

  // Open sheet with Ulysses ID
  openSheet(targetID) {
    var callbackAction = "open";
    var baseURL = this.callbackURL + callbackAction;
    var params = { id: this.targetID };
    this._openCallback(baseURL, params, false);
  }

  // Create a new sheet using preset groupID or displaying a prompt to choose
  createSheet(sheetText, groupID) {
    var callbackAction = "new-sheet";

    // callback Params
    var params = {
      group: groupID,
      text: sheetText,
    };
    var baseURL = this.callbackURL + callbackAction;
    var response = this._openCallback(baseURL, params);
    this.targetID = response.targetId;
  }

  // Converts MultiMakdown tags into Markdown XL
  convertMarkdown(content) {
    // Converts highlight tags `{==` and `==}` into `::`
    return content.replace(/\{==/g, "::").replace(/==\}/g, "::");
  }

  // Attach a note to the sheet that was just created
  attachNote() {
    // this.callbackURL Params
    var callbackAction = "attach-note";
    var params = {
      id: this.targetID,
      text: HTML.escape(noteText),
    };
    var baseURL = this.callbackURL + callbackAction;
    this._openCallback(baseURL, params, false);
  }

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

  // Attach tags to the sheet that was just created
  attachTags(keywords) {
    // this.callbackURL Params
    var callbackAction = "attach-keywords";
    // A targetID is needed to attach keywords
    // If a targetID has not been set callback will not work
    if (this.targetID) {
      var params = {
        id: this.targetID,
        keywords: keywords,
      };
      var baseURL = this.callbackURL + callbackAction;
      this._openCallback(baseURL, params);
    }
  }

  //Authorize Drafts with Ulysses and save credentials
  _authorize() {}

  // Open this.callbackURL
  _openCallback(
    baseURL,
    params = {},
    waitForResponse = true,
    message = "Sucess!"
  ) {
    // open and wait for result
    var cb = CallbackURL.create();
    cb.waitForResponse = waitForResponse;
    cb.baseURL = baseURL;
    for (const [key, value] of Object.entries(params)) {
      cb.addParameter(key, value);
    }
    var success = cb.open();
    if (success) {
      console.log(message);
    } else {
      // something went wrong or was cancelled
      console.log(cb.status);
      if (cb.status == "cancel") {
        context.cancel();
      } else {
        context.fail();
      }
    }
    return cb.callbackResponse;
  }
}
