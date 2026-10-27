require("modules/nr/BearSender.js");

// Bear: New & Return. Sends the draft to Bear and comes straight back to Drafts.
new BearSender().sendAndReturn("bear-note.md");
