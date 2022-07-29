// Helper method that waits for number of MS
function sleep(p_intMSDelay) {
  let dtStart = new Date().getTime();
  let dtEnd = dtStart;
  while (dtEnd < dtStart + p_intMSDelay) {
    dtEnd = new Date().getTime();
  }
}

function displayErrorMessage(message, details = {}) {
  app.displayErrorMessage(message);
  const errorLog = Draft.find("F59242F5-8096-44A6-B8DC-529DA4082AAC");
  const timeCode = new Date().toString();
  errorLog.append(`**${message}**`, `\n\n--------- ${timeCode}\n`);
  for (const [key, value] of Object.entries(details)) {
    errorLog.append(`- ${key}: ${value}`, "\n");
  }
  errorLog.update();

  context.cancel();
  return false;
}

function displayInfoMessage(message) {
  if (this._debug) console.log(message);

  app.displayInfoMessage(message);
  return context.cancel();
}

// Helper method that throws an alert displaying the variable passed to it
function debugVariable(variable, message = "") {
  message = message + JSON.stringify(variable);

  console.log(message);
  if (this._debug) alert(message);
}

// Parses JSON file saved in iCloud
function parseJSONFromiCloudFile(file) {
  let fmCloud = FileManager.createCloud(); // Connect to iCloud storage
  return fmCloud.readJSON(this.filesPath + file);
}

function functionToRunNext(name, args) {
  if (!name) return this._displayErrorMessage("Error: Function name missing (_functionToRunNext)");
  if (!Array.isArray(args)) args = [args];

  // Log & run function
  console.log(`\n\n#######\nRunning function: ${name}`);
  return this[name].apply(this, args);
}

function typeCheckString(variable, location) {
  const varType = Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
  if (varType == "string") return true;
  this._continueWithWarning(
    "Type mismatch error! Check the logs.",
    `Type mismatch: Ulysses-v2.js, ${location}\nExpected type 'string', got '${varType}' instead.`
  );
  return false;
}

function continueWithWarning(message, details) {
  app.displayWarningMessage(message);
  console.log(`******* Warning *******\n${details}`);
}

function lookUpDestinationID(key) {
  const id = this._destinations[key];

  return id != undefined ? id : { groupID: null };
}

// ********************
// ** Text Functions
// ********************

// Converts string to Title Case
function titleCase(str) {
  str = str.toLowerCase().split(" ");
  for (var i = 0; i < str.length; i++) {
    str[i] = str[i].charAt(0).toUpperCase() + str[i].slice(1);
  }
  return str.join(" ");
}

// Converts a title to slug by replacing ' ' with '-'
function convertTitleToSlug(title) {
  const removeChars = new RegExp(/[:\\"'\\?\\(\\)-,]/, "g");
  return title.toLowerCase().replace(removeChars, "").replace(/[ ]+/g, "-");
}

// Removes destination prefixes from Title
function scrubTitle(title, key) {
  if (!key) return this._displayErrorMessage("Error: Key missing!");
  key = key.toLowerCase();
  const destination = this._destinations[key];
  if (!destination) return this._displayErrorMessage("Error: Destination not found! Please update destinations.json.");

  if ("scrubText" in destination) {
    let regEx = new RegExp(destination.scrubText, "ig");
    return title.replace(regEx, "");
  }
  return title;
}
