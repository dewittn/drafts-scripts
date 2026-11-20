require("shared/libraries/CriticMarkup.js");
require("shared/libraries/DraftsUI.js");

// Resolves the CriticMarkup mark the cursor is in, or asks which mark to add
// around the selection when it is outside every mark.
const markName =
  CriticMarkup.innermostMarkName(editor.getText(), editor.getSelectedRange()) || chooseMark();

if (markName) CriticMarkup.toggleInEditor(editor, markName);
else editor.activate();

// Shows a button for each mark and returns the one picked, or null on cancel.
function chooseMark() {
  const menu = new DraftsUI().buildMenu({ menuTitle: "CriticMarkup", menuItems: CriticMarkup.menuItems() });
  return menu.show() ? menu.buttonPressed : null;
}
