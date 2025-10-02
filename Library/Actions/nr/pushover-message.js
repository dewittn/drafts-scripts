require("../Scripts/modules/nr/PushoverAlert.js");

const pushover = new PushoverAlert();

pushover.message = draft.content;
pushover.send();
