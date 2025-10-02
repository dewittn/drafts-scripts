// Create New 'Beyond The Book' Draft
require("modules/cp/templates/BeyondTheBook.js");

const draft = new BeyondTheBook();
draft.save().activate().addToPipeline();
