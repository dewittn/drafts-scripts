// A simple interface for Drafts to interact with the Ulysses writing app
// ulysses://x-callback-url/new-sheet?text=[[draft]]&group=[[groupID]]
class Ulysses {
  constructor() {
      this.callbackURL = "ulysses://x-callback-url/";
      this.targetID = {};
  }
  
  // Open sheet with Ulysses ID
  openSheet(this.targetID) {
    var callbackAction = "open";
    var baseURL = this.callbackURL + callbackAction;
    var params = new Map([["id", this.targetID]]);
    openCallback(baseURL, params, false);
  }
  
  // Create a new sheet using preset groupID or displaying a prompt to choose
  createSheet() {
    var callbackAction = "new-sheet";
  
    // callback Params
    var params = new Map([
      ["group", groupID],
      ["text", sheetText],
    ]);
    var baseURL = this.callbackURL + callbackAction;
    this.targetID = openCallback(baseURL, params).this.targetID;
  }
  
  // Converts MultiMakdown into Markdown XL
  convertMarkdown() {
    draft.content = draft.content.replace(/\{==/g, "++").replace(/==\}/g, "++");
    draft.update();
  }

  // Attach a note to the sheet that was just created
  attachNote() {
    // this.callbackURL Params
    callbackAction = "attach-note";
    var params = new Map([
      ["id", this.targetID],
      ["text", HTML.escape(noteText)],
    ]);
    baseURL = this.callbackURL + callbackAction;
    openCallback(baseURL, params, false);
  }
  
  // Converts Draft tags into 
  convertTagsToKeywords(tags) {
    tags = draft.tags;
    if (tags.length > 0) {
      tags.forEach(capitalize);
      function capitalize(tag, index) {
        tags[index] = tag.charAt(0).toUpperCase() + tag.slice(1);
      }
    }
    return tags;
  }
  
  // Attach tags to the sheet that was just created
  attachTags() {
    // this.callbackURL Params
    callbackAction = "attach-keywords";
    var params = new Map([
      ["id", this.targetID],
      ["keywords", processTags(keywords)],
    ]);
    baseURL = this.callbackURL + callbackAction;
    openCallback(baseURL, params);
  }
  
  //Authorize Drafts with Ulysses and save credentials
  _authorize(){
    
  }

  // Open this.callbackURL
  _openCallback(baseURL, params = new Map([]), waitForResponse = true, message = "Sucess!") {
   // open and wait for result
   var cb = this.callbackURL.create();
   cb.waitForResponse = waitForResponse;
   cb.baseURL = baseURL;
   for (const [key, value] of params.entries()) {
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