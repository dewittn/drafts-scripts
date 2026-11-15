// Content Pipeline on the NocoDB Test Table, with debug logging on.
// Use it to try new CP actions without touching production records.
require("modules/cp/core/ContentPipeline.js");

const cp = new ContentPipeline("Test Table");
cp.debug = true;
cp.welcome();
