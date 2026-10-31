require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");

// A refresher on how to write drafts for Things Parser: one prompt per page,
// with Next and Done. The pages are under `things.help` in nr-settings.yaml.
function thingsFormatHelp() {
  const { help } = loadSettings("nr-settings.json").things;
  new DraftsUI().showPages(help);
}

thingsFormatHelp();
