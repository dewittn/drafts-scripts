// CallbackURL step up
// ulysses://x-callback-url/new-sheet?text=[[draft]]&group=[[groupID]]
const callbackURL = "ulysses://x-callback-url/";
var keywords = draft.getTemplateTag("keywords");
var groupID = draft.getTemplateTag("groupID");
var sheetText = draft.content;
var noteText = draft.getTemplateTag("noteText");
var targetID;

// Open callbackURL
function openCallback(
  baseURL,
  params = new Map([]),
  waitForResponse = true,
  message = "Sucess!"
) {
  // open and wait for result
  var cb = CallbackURL.create();
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

function processTags(tags) {
  if (!tags) {
    // Prompt
    /* --------------------- */
    var lists = ["Yes", "No"];

    var p = Prompt.create();
    p.title = "Attach Tags?";
    p.message = "Attaches tags to recently created sheet.";
    for (var list of lists) {
      p.addButton(list);
    }
    var con = p.show();

    if (con) {
      if (p.buttonPressed == "Yes") {
        tags = draft.tags;
        if (tags.length > 0) {
          tags.forEach(capitalize);

          function capitalize(tag, index) {
            tags[index] = tag.charAt(0).toUpperCase() + tag.slice(1);
          }
        }
      }
    } else {
      context.cancel();
    }
  }
  return tags;
}

// Converts MultiMakdown into Markdown XL
function convertMarkdown() {
  draft.content = draft.content.replace(/\{==/g, "++").replace(/==\}/g, "++");
  draft.update();
}

function newsletter() {
  // Set variables for Newsletters
  keywords = ["Newsletter", "Writing"];
  groupID = "_irtj5J8siY8DXj0E4ckmA";
  noteText = "This is a placeholder for the excerpt!!";
}

function beyondTheBook() {
  // Set variables for Newsletters
  keywords = ["Beyond The Book", "Writing"];
  groupID = "_irtj5J8siY8DXj0E4ckmA";
  noteText = "This is a placeholder for the excerpt!!";
}

// Create a new sheet using preset groupID or displaying a prompt to choose
function createSheet() {
  var callbackAction = "new-sheet";

  if (groupID == "") {
    var p = Prompt.create();
    let locations = new Map([
      ["Inbox", "hZ7IX2jqKbVmPGlYUXkZjQ"],
      ["nr.com", "_irtj5J8siY8DXj0E4ckmA"],
      ["Web Hosting", "WgLHy2d17CyYfHPp5YqvKw"],
      ["Compost", "ENEob3biouihroN9R9yFSw"],
    ]);

    for (let name of locations.keys()) {
      p.addButton(name);
    }

    if (p.show()) {
      groupID = locations.get(p.buttonPressed);
    }
  }

  // callback Params
  var params = new Map([
    ["group", groupID],
    ["text", sheetText],
  ]);
  var baseURL = callbackURL + callbackAction;
  targetId = openCallback(baseURL, params).targetId;
}

// Attach tags to the sheet that was just created
function attachTags() {
  // callbackURL Params
  callbackAction = "attach-keywords";
  var params = new Map([
    ["id", targetId],
    ["keywords", processTags(keywords)],
  ]);
  baseURL = callbackURL + callbackAction;
  openCallback(baseURL, params);
}

// Attach a note to the sheet that was just created
function attachNote() {
  // callbackURL Params
  callbackAction = "attach-note";
  var params = new Map([
    ["id", targetId],
    ["text", HTML.escape(noteText)],
  ]);
  baseURL = callbackURL + callbackAction;
  openCallback(baseURL, params, false);
}

// Main function to start export
function processDraft() {
  if (draft.hasTag("newsletter")) {
    newsletter();
  }
  if (draft.hasTag("beyond the book")) {
    beyondTheBook();
  }
  convertMarkdown();
  createSheet();
  attachTags();
  if (noteText) {
    attachNote();
  }
}

function openSheet(targetId) {
  var callbackAction = "open";
  var baseURL = callbackURL + callbackAction;
  var params = new Map([["id", targetId]]);
  openCallback(baseURL, params, false);
}
