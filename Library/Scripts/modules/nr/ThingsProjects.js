if (typeof openCallback == "undefined") require("vendor/nr.js");

// The open Things projects, read from a shortcut (Get Things Projects) whose
// output is {"projects": [{"title": "...", "id": "..."}, ...]}. Drafts cannot
// read Things itself, and the projects change too often to list in settings.
class ThingsProjects {
  static shortcutURL = "shortcuts://x-callback-url/run-shortcut";

  // Runs the shortcut and waits for its output. Null when the shortcut fails
  // or its output cannot be read.
  static fetch(shortcutName) {
    // openCallback returns the callback's parameters, or nothing on failure.
    const response = /** @type {{ result?: string } | undefined} */ (
      openCallback(ThingsProjects.shortcutURL, { name: shortcutName }, true, `Ran ${shortcutName}`)
    );
    return ThingsProjects.parse(response?.result);
  }

  // The projects in the shortcut's output, or null when it is not that JSON.
  static parse(output) {
    try {
      const { projects } = JSON.parse(output);
      return Array.isArray(projects) ? projects.filter((project) => project.title) : null;
    } catch {
      return null;
    }
  }

  // A button label per project: its title, with " (2)", " (3)" ... added to
  // a title an earlier project already has.
  static labels(projects) {
    const seen = {};
    return projects.map(({ title }) => {
      seen[title] = (seen[title] ?? 0) + 1;
      return seen[title] == 1 ? title : `${title} (${seen[title]})`;
    });
  }
}
