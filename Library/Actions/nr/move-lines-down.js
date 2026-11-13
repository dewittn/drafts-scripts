require("shared/libraries/LineMover.js");

// Moves the line under the cursor, or every line the selection touches, down
// one line. See LineMover for how the selection is treated.
LineMover.moveInEditor(editor, "down");
