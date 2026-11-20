require("shared/libraries/CriticMarkup.js");

// Wraps the selection as {~~ old ~>  ~~} with the cursor ready for the new
// text, or accepts the substitution the cursor is in, leaving the new text
// selected. See CriticMarkup.
CriticMarkup.toggleInEditor(editor, "substitution");
