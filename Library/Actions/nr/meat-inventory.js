require("vendor/nr.js");
const settings = loadSettings("nr-settings.json");
const { actionGroup, meatsTemplate, meatsDraftUUID } = settings.meats;
const meatsDraft = Draft.find(meatsDraftUUID);

meatsDraft.active();
