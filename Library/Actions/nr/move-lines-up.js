require("shared/libraries/LineMover.js");

// Moves the line under the cursor, or every line the selection touches, up
// one line. See LineMover for how the selection is treated.
LineMover.moveInEditor(editor, "up");
