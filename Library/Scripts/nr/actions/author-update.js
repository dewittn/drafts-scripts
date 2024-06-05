require("cp/ui/DraftsUI.js");
require("cp/filesystems/CloudFS.js");
require("cp/templates/Template.js");
require("cp/templates/AuthorUpdate.js");

const update = new AuthorUpdate();
update.save().activate().addToPipeline();
