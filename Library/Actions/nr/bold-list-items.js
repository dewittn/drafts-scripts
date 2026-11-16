require("modules/nr/BoldListItems.js");

// Bolds the short label that leads each list item in the draft, such as
// "- **Evernote.** They do…". See BoldListItems for what counts as a label.
draft.content = BoldListItems.text(draft.content);
draft.update();
editor.activate();
