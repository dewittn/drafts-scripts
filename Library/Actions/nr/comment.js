require("shared/libraries/CriticMarkup.js");

// Turns the selection into a comment, {>> text <<}, inserts an empty comment
// at the cursor, or removes the comment the cursor is in. See CriticMarkup for
// the details.
CriticMarkup.toggleInEditor(editor, "comment");
