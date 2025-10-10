require("shared/core/ServiceInitializer.js");
initializeServices();

const cp = ServiceContainer.getInstance().get('cpDefault');
cp.addDocToPipeline("UlyssesID");
