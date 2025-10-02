require("vendor/nr.js");
const settings = loadSettings("nr-settings.yaml");
const { actionGroup, meatsTemplate, meatsDraftUUID } = settings.meats;
const meatsDraft = Draft.find(meatsDraftUUID);

meatsDraft.active();
