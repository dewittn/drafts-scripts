require("../Scripts/vendor/nr.js");
const settings = loadSettings("nr-settings.yaml");
const { actionGroup, meatsTemplate, meatsDraftUUID } = settings.meats;
const meatsDraft = Draft.find(meatsDraftUUID);

// read from file in iCloud
const fmCloud = FileManager.createCloud(); // iCloud
const template = fmCloud.readString(meatsTemplate);

const insestTxet = meatsDraft.processTemplate(template);
meatsDraft.insert(insestTxet, 2);

const regEx = /## (.*)\n\n/;
if (meatsDraft.content.match(regEx)) meatsDraft.content = meatsDraft.content.replace(regEx, "");

meatsDraft.update();
meatsDraft.activate("default", actionGroup);
