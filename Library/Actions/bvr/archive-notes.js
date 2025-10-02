if (typeof Team == "undefined") require("modules/bvr/core/Team.js");

const team = Team.getInstance();
team.archiveNotes();
