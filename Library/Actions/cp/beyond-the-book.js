// Create New 'Beyond The Book' Draft
require("../Scripts/modules/cp/templates/BeyondTheBook.js");

const draft = new BeyondTheBook();
draft.save().activate().addToPipeline();
