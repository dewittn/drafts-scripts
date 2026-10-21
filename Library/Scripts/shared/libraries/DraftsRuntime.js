// Helpers for two Drafts runtime gotchas in docs/reference/drafts-runtime.md.
// No load-time dependencies, so any module or action can require it.
class DraftsRuntime {
  // The draft with this uuid, as the global draft when it is the open one:
  // Drafts writes that object back when the script step ends.
  static findDraft(uuid) {
    if (typeof draft != "undefined" && draft.uuid == uuid) return draft;
    return Draft.find(uuid);
  }

  // Show a workspace unless it is already showing (each applyWorkspace call
  // keeps about 1 MB of native memory). False when skipped. shownAs: the name
  // app.currentWorkspace reports, when it is not the one Workspace.find takes.
  static loadWorkspace(name, shownAs = name) {
    if (app.currentWorkspace.name == shownAs) return false;
    app.currentWindow.applyWorkspace(Workspace.find(name));
    return true;
  }
}
