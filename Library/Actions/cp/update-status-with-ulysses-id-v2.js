require("shared/core/ServiceInitializer.js");
initializeServices();

const uuid = draft.content;
const cp = ServiceContainer.getInstance().get('cpDefault');
cp.updateStatusOfDoc(uuid, "UlyssesID");
