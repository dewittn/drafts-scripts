// NR Scripts for Drafts App
// This is a test
//------------
// Extend Draft Object

// draft.insertTemplate("file.md");
Draft.prototype.insertTemplate = function (templateName) {
  if (templateName == undefined) return;

  // read from file in iCloud
  const fmCloud = FileManager.createCloud(); // iCloud
  const templateDir = "/Library/Templates/";
  const template = fmCloud.readString(templateDir + templateName);

  this.content = this.processTemplate(template);
  this.update();
};

// draft.activate
Draft.prototype.activate = function (actionGroup, workspaceName = "default") {
  editor.load(this);
  editor.activate();

  // find workspace and load it in drafts list
  const workspace = Workspace.find(workspaceName);
  app.currentWindow.applyWorkspace(workspace);

  if (actionGroup != undefined) {
    const group = ActionGroup.find(actionGroup);
    app.loadActionBarGroup(group);
  }
};

// draft.archive
Draft.prototype.archive = function () {
  this.isAchived = true;
  this.update();
};

// draft.trash
Draft.prototype.trash = function () {
  this.isTrashed = true;
  this.update();
};

//---------//
// Global Functions

// const d = newDraft();
function newDraft(draftTags, template, templateTags) {
  const d = Draft.create();
  // draftsTags should be formatted as an array like this: ["tag1", "tag2", "tag3"]
  draftTags.forEach((tag) => d.addTag(tag));

  // Set Template Tags to be processed with template
  // templateTags should be formatted as an object like this: { key1: "value", key2: "other value"}
  // Important: keys are not strings!
  if (templateTags != undefined) {
    for (const [key, value] of Object.entries(templateTags)) {
      d.setTemplateTag(key, value);
    }
  }

  // template is a string that refers to a file like this: "innocent-dreams-newsletter.md"
  if (template != undefined) d.insertTemplate(template);

  return d;
}

// fetchTempalte
function fetchTemplate(templateName) {
  var template;
  if (templateName) {
    // read from file in iCloud
    let fmCloud = FileManager.createCloud(); // iCloud
    let templateDir = "/Library/Templates/";
    template = fmCloud.readString(templateDir + templateName);
  } else {
    template = "";
  }
  return template;
}

// capitazlize
// const capitalize = (str, lower = false) =>
//   (lower ? str.toLowerCase() : str).replace(/(?:^|\s|["'([{])+\S/g, (match) =>
//     match.toUpperCase()
//   );

function capitalize(str, lower = false) {
  if (lower) {
    return str.toLowerCase();
  } else {
    return str.replace(/(?:^|\s|["'([{])+\S/g, (match) => match.toUpperCase());
  }
}

// Append Tags to bottom of draft for bear import
function appendTags() {
  var appendText = "\n";
  var tags = draft.tags;

  if (tags.length > 0) {
    tags.forEach(splitTags);
    function splitTags(tag, index) {
      var endText = /\s/.test(tag) ? "#" : "";
      tags[index] = "#" + capitalize(tag) + endText;
    }

    appendText += tags.join("\n");
    draft.content += appendText;
    draft.update();
  }
}

// Creates a template tag called [[hashTags]]
// Output is a string of tags separated by spaces and prefixed by a '#'
function hashTags(spaceReplaceChar = "/") {
  var appendText = "\n";
  var tags = draft.tags;

  if (tags.length > 0) {
    tags.forEach(splitTags);
    function splitTags(tag, index) {
      tags[index] = "#" + capitalize(tag).replace(/ /g, spaceReplaceChar);
    }

    draft.setTemplateTag("hashTags", tags.join(" "));
  }
}

// Menu System
function actionMenu(actions) {
  const draftAction = draft.getTemplateTag("draft_action");
  const nextAction = Action.find(
    draftAction == undefined ? draftAction : chooseAction(actions),
  );

  app.queueAction(nextAction, draft);
}

function chooseAction(actions) {
  let p = Prompt.create();
  p.title = "Choose Next Action";
  actions.forEach((action) => p.addButton(action));

  if (p.show() == false) context.cancel();

  return actions.filter((action) => p.buttonPressed == action)[0];
}

// Open callbackURL
function openCallback(
  baseURL,
  params = {},
  waitForResponse = true,
  message = "Sucess!",
) {
  // open and wait for result
  const cb = CallbackURL.create();
  cb.waitForResponse = waitForResponse;
  cb.baseURL = baseURL;

  for (const [key, value] of Object.entries(params)) {
    cb.addParameter(key, value);
  }

  if (cb.open() == false) {
    // something went wrong or was cancelled
    console.log(cb.status);
    return context.fail();
  }

  console.log(message);
  return cb.callbackResponse;
}

// Helper method that displays a message with OK button only.
function displayMessage(title, message) {
  const p = Prompt.create();
  p.title = title;
  p.message = message;
  p.addButton("OK", true);
  p.isCancellable = false;
  return p.show();
}

function setCursorLocation(d) {
  // look for <|> to set cursor location
  let loc = d.content.search("<|>");
  if (loc != -1) {
    editor.setText(editor.getText().replace("<|>", ""));
    editor.setSelectedRange(loc, 0);
  }
}

// Parses JSON file saved in iCloud
function parseJSONFromiCloudFile(file, filesPath = "/Library/Data/") {
  let fmCloud = FileManager.createCloud(); // Connect to iCloud storage
  return fmCloud.readJSON(filesPath + file);
}

function getWorkingTitle() {
  let p = Prompt.create();
  p.title = "Working title?";
  p.message = "Please enter a working title for your draft (no markdown):";

  p.addTextField("workingTitle", "", "");
  p.addButton("Ok");

  if (p.show() == false) return "";

  return p.fieldValues["workingTitle"];
}

function loadSettings(file) {
  const fmCloud = FileManager.createCloud(); // iCloud
  const jsonFile = file.replace(/\.yaml$/, ".json");
  return fmCloud.readJSON(`/Library/Data/${jsonFile}`);
}
