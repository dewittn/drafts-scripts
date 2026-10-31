require("vendor/nr.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/ThingsProjects.js");
require("modules/nr/ThingsTags.js");

// Lists the open Things projects and types the chosen one's tag at the cursor,
// e.g. "@project(LLC Taxes)", so a to-do lands in that project. The projects
// come from the shortcut named `things.projectsShortcut` in nr-settings.yaml.
function insertThingsProject() {
  const { projectsShortcut, projectMenu } = loadSettings("nr-settings.json").things;
  const ui = new DraftsUI();

  const projects = ThingsProjects.fetch(projectsShortcut);
  if (projects == null) return context.fail(`${projectsShortcut} did not return the projects`);
  if (projects.length == 0) return ui.displayWarningMessage("No open projects in Things");

  const menuItems = ThingsProjects.labels(projects).map((label, index) => ({
    type: "button",
    data: { name: label, value: index },
  }));
  const menu = ui.buildMenu({ ...projectMenu, menuItems });
  if (!menu.show()) return context.cancel();

  ui.insertAtCursor(ThingsTags.project(projects[menu.buttonPressed], projects));
}

insertThingsProject();
