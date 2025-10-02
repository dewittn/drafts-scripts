const oneSecond = 10000;
const recentlyCreated = new Date() - draft.createdAt < oneSecond;
const teamID = recentlyCreated ? draft.content : "";

if (typeof Team == "undefined") require("modules/bvr/core/Team.js");

const team = Team.getInstance(teamID);

const submitAttendace = team.takeAttendace();
if (submitAttendace) team.submitAttendace();

// Note: Don't delete singleton - it persists intentionally
