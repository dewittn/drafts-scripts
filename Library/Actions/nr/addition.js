require("shared/libraries/CriticMarkup.js");

// Marks the selection as an addition, {++ text ++}, inserts an empty one at
// the cursor, or accepts the addition the cursor is in. See CriticMarkup.
CriticMarkup.toggleInEditor(editor, "addition");
