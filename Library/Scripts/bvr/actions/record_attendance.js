const oneSecond = 10000;
const recentlyCreated = new Date() - draft.createdAt < oneSecond;
const teamID = recentlyCreated ? draft.content : "";

if (typeof BVR == "undefined") require("bvr/BVR.js");

const team = new Team(teamID);

const submitAttendace = team.takeAttendace();
if (submitAttendace) team.submitAttendace();

delete team;
