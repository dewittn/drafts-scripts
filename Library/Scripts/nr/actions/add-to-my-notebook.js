require("nr.js");
require("libraries/bear.js");

const templateName = "bear-note.md";
const bearURL = `bear://x-callback-url/create`;

bearTags();
updateWikiLinks();

// Read template from file in iCloud
const fmCloud = FileManager.createCloud(); // iCloud
const template = fmCloud.readString(`/Library/Templates/${templateName}`);

// Construct openCallBack URL
const params = { text: draft.processTemplate(template) };
openCallback(bearURL, params, false);

draft.trash();
