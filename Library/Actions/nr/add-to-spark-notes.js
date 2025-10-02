require("../Scripts/vendor/nr.js");
require("../Scripts/shared/libraries/bear.js");

const templateName = "spark-note.md";
const bearURL = `bear://x-callback-url/create`;

// Read template from file in iCloud
const fmCloud = FileManager.createCloud(); // iCloud
const template = fmCloud.readString(`/Library/Templates/${templateName}`);

// Construct openCallBack URL
const params = { text: draft.processTemplate(template) };
openCallback(bearURL, params, false);

draft.trash();
