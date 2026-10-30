require("shared/libraries/DraftsUI.js");
require("modules/nr/ThingsTags.js");

// Starts a note line under the cursor's to-do or project for Things Parser:
// a new line, indented one tab deeper (or level with the note the cursor is
// on). The cursor's line is left whole, wherever the cursor is in it.
function addNote() {
  const ui = new DraftsUI();
  ui.insertAtLineEnd(ThingsTags.noteBreak(ui.currentLine()));
}

addNote();
