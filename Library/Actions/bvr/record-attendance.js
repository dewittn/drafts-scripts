const oneSecond = 10000;
const recentlyCreated = new Date() - draft.createdAt < oneSecond;
const teamID = recentlyCreated ? draft.content : "";

require("shared/core/ServiceInitializer.js");
initializeServices();

const container = ServiceContainer.getInstance();
const team = container.get('teamFactory')(teamID);

const submitAttendace = team.takeAttendace();
if (submitAttendace) team.submitAttendace();

// Note: Don't delete singleton - it persists intentionally
