// Meat inventory
require("../Scripts/vendor/nr.js");
const settings = loadSettings("nr-settings.yaml");
const { actionGroup, taskChoices, meatsDraftUUID, defaultTags, thingsListName } = settings.meats;

const meatsDraft = Draft.find(meatsDraftUUID);
meatsDraft.activate(actionGroup);

const tasks = [],
  linesToRemove = [],
  regExp = /- \[x\]/g,
  draftLines = meatsDraft.lines;

function processLine(text) {
  const item = text.replace("- [x] ", "");
  const title = `Take out the ${item}`;

  const p = Prompt.create();
  p.title = "Day to create reminder?";
  p.message = `For item: ${item}`;
  taskChoices.forEach((choice) => p.addButton(choice));

  if (p.show() == false) return context.cancel();

  // Store task in array unless title is blank
  if (p.buttonPressed == "Remove Only" || title == "") return;

  // Build task for things
  let task = TJSTodo.create(); // Create blank things todo
  task.list = thingsListName;
  task.title = title;
  task.tags = defaultTags.forEach((tag) => tag.trim());
  task.when = p.buttonPressed;
  tasks.push(task);
}

// Loop through each line looking for tasks
draftLines.forEach((line, index) => {
  if (line.match(regExp)) {
    processLine(line);
    linesToRemove.push(index);
  }
});

if (tasks.length != 0) {
  // create a container to handle creation of Things URL
  const container = TJSContainer.create(tasks);

  // Use CallbackURL object to open URL in Things.
  const cb = CallbackURL.create();
  cb.baseURL = container.url;

  if (cb.open() == false) console.log("There was an error!");
}

// Remove lines once tasks have been processed
linesToRemove.reverse().forEach((index) => draftLines.splice(index, 1));

// Keep a record before any changes just in case
// Then remaining lines back together and save
meatsDraft.saveVersion();
meatsDraft.content = draftLines.join("\n");
meatsDraft.update();
