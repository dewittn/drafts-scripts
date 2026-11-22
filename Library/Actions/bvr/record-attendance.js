const oneSecond = 10000;
const recentlyCreated = new Date() - draft.createdAt < oneSecond;
const teamID = recentlyCreated ? draft.content : "";

require("modules/bvr/core/BVR.js");

const team = new Team(teamID);

const submitAttendance = team.takeAttendance();
if (submitAttendance) team.submitAttendance();
