require("shared/libraries/PushoverAlert.js");

const pushover = new PushoverAlert();

pushover.message = draft.content;
pushover.send();
