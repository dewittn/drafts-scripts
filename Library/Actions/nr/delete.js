require("shared/libraries/CriticMarkup.js");

// Marks the selection for deletion as {-- text --}, or deletes the marked
// text the cursor is in. See CriticMarkup for the details.
CriticMarkup.toggleInEditor(editor, "deletion");
