require("cp/templates/AuthorUpdate.js");

const draft = new AuthorUpdate();
draft.save().activate().addToPipeline();
