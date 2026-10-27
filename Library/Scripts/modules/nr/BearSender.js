if (typeof Bear == "undefined") require("shared/libraries/bear.js");
if (typeof fetchTemplate == "undefined") require("vendor/nr.js");

// Sends a draft to Bear as a new note, rendered through a template in
// Library/Templates/, then trashes the draft.
//
// Before rendering it sets the [[bearTags]] template tag from the draft's tags
// and turns [[bear:Note]] wiki links into Bear's [[Note]]. If Bear reports an
// error the draft is kept.
class BearSender {
  #bear;

  constructor(bear = Bear.create()) {
    this.#bear = bear;
  }

  // Creates the note with a plain URL, so Bear stays open on it.
  sendAndStay(templateName, d = draft) {
    return this.#send(templateName, d, { returnToDrafts: false });
  }

  // Creates the note without opening it and waits for Bear's x-success, which
  // brings Drafts back to the front.
  sendAndReturn(templateName, d = draft) {
    return this.#send(templateName, d, { openNote: "no", showWindow: "no" });
  }

  #send(templateName, d, options) {
    bearTags(d);
    updateWikiLinks(d);
    const text = d.processTemplate(fetchTemplate(templateName));

    this.#bear.create(null, text, "", options);
    if (this.#bear.error) return false;

    d.isTrashed = true;
    d.update();
    return true;
  }
}
