# Drafts Runtime Behavior

Facts about how Drafts runs these scripts that are not obvious from the code and have caused real bugs. Each was verified in the app; dates and Drafts versions are noted where known.

## Every action run starts from scratch

Each action run gets a fresh JavaScriptCore context. Globals and class static fields reset on every run, and the JS heap is freed when the run ends. Verified 2026-10-12 on Drafts 54.1: a `globalThis` counter and a `static` counter both read 1 on four consecutive runs.

Caching or singletons that rely on state surviving between runs cannot work. Within one run, plain object reuse or the per-run `ServiceContainer` registry is all that applies. Anything that must persist goes in a file, a draft, or Drafts' own storage.

The October 2025 singleton work (`getInstance()` on BVR, Team, ContentPipeline) assumed otherwise and was removed in PR #7.

## Drafts writes the global `draft` back when a script step ends

When an action runs on a draft that is open in the editor, Drafts writes the global `draft` object back to the editor when the script step finishes. Changes made to the same draft through a separate `Draft.find()` copy appear briefly and then revert, even after `editor.setText()`.

Mutate the global `draft` when it is the target. `DraftsRuntime.findDraft()` in `shared/libraries/DraftsRuntime.js` does this:

```javascript
const target = DraftsRuntime.findDraft(targetID); // draft when draft.uuid == targetID, else Draft.find(targetID)
```

Found on the Record Attendance action (PR #5, 2026-10-10).

## Workspaces

- `app.currentWindow.applyWorkspace()` keeps about 1 MB of native memory per call. `DraftsRuntime.loadWorkspace()` skips the call when `app.currentWorkspace.name` already matches; every call site goes through it.
- `applyWorkspace(undefined)` resets the window to the built-in "Default" workspace. No saved workspace is named "default". It shows as "Default", so `loadWorkspace("default")` always resets; `loadWorkspace("default", "Default")` skips while it is showing (DraftsDocument does this).
- Native methods such as `applyWorkspace` cannot be monkeypatched from JS, so a wrapper never sees the calls.

## Testing inside Drafts with the Eval Draft action

The Drafts MCP server's `drafts_run_action` only returns "Ran action", never output. To see results:

1. Create a scratch draft whose content is JavaScript.
2. Run the native **Eval Draft** action on it.
3. Read the draft back. Eval Draft appends `//-//` and the value of the script's **last expression**. It overwrites any `draft.content = ...` you set yourself, so make the report string the final expression.
4. Trash the scratch draft.

To run a unit test file this way, capture `console.log` into an array, `require("../Tests/unit/...-test.js")` inside try/catch, restore `console.log`, and end with the joined output. Run one test file per Eval run: test files declare a top-level `const test`, so a second file in the same context throws a redeclaration error.

Avoid actions that call `alert()` (such as "Singleton Simple") when driving Drafts through the MCP server. An alert blocks until someone dismisses it.

## Build environment

Commits are SSH-signed through `op-ssh-sign`, and `bun run sync` runs `op inject` for `.yaml.tpl` secrets. Both fail with "1Password: Could not connect to socket. Is the agent running?" when the 1Password **desktop app** is not running (the Safari extension alone does not count). Check `pgrep -x 1Password`. If it is absent, `open -a 1Password`, wait a few seconds, and retry. If it is running and Claude Code's sandbox is on, the sandbox is blocking the socket.

A failed `op inject` leaves the BVR and CP JSON untouched, because the YAML conversion errors out. Re-run `bun run sync` once 1Password is up.
