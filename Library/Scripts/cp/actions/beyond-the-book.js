// Create New 'Beyond The Book' Draft
require("cp/templates/BeyondTheBook.js");

const draft = new BeyondTheBook();
draft.save().activate().addToPipeline();
