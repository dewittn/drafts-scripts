require("shared/core/ServiceInitializer.js");
initializeServices();

const container = ServiceContainer.getInstance();
const team = container.get('teamFactory')();
team.archiveNotes();
