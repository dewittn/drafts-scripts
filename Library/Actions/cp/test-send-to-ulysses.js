// Test action: creates a Ulysses sheet in Inbox from this draft and copies the
// converted Markdown XL to the clipboard. Ulysses escapes Markdown XL markers
// on any normal import, so paste from the clipboard with Edit > Paste > Raw
// Source Block, then remove the block to get the formatting. The draft itself
// is not changed.
require("shared/libraries/ulysses-v2.js");
require("modules/cp/utils/TextUtilities.js");

// Inbox group ID, from Library/Data/cp/destinations.yaml
const INBOX_ID = "hZ7IX2jqKbVmPGlYUXkZjQ";

const markdownXL = new TextUtilities().convertMarkdown(draft.content);
const ulysses = Ulysses.create();
const sheet = ulysses.newSheet(markdownXL, INBOX_ID);

// The Ulysses error message getter loops on itself, so only the code is read.
if (ulysses.error || sheet?.identifier == undefined) {
  app.displayErrorMessage(`Ulysses error ${ulysses.errorCode}: sheet not created`);
} else {
  app.setClipboard(markdownXL);
  app.displayInfoMessage("Sheet created. In Ulysses, select all, then Edit > Paste > Raw Source Block.");
}
