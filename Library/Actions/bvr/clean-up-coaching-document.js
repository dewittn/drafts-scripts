// Moves practice plan links that ended up outside their team's section of the
// BVR Coaching draft back under the team's heading, adding the heading when
// the team has none. Uses the same placement as Create Practice Plan.
require("modules/bvr/core/BVR.js");
require("modules/bvr/core/CoachingDocument.js");

new CoachingDocument(new BVR()).cleanUp();
