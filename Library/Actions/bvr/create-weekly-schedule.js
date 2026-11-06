require("modules/bvr/core/BVR.js");

// Always show the picker of teams in season, even when there is only one.
const team = new Team("", { alwaysAsk: true });
team.createWeeklySchedule();
