require("bvr/BVR.js");
{
  const oneSecond = 1000;
  const recentlyCreated = new Date() - draft.createdAt < oneSecond;

  const teamID = recentlyCreated ? draft.content : "";
  const team = new Team(teamID);

  const submitAttendace = team.takeAttendace();
  if (submitAttendace) team.submitAttendace();
}
