---
name: drafts-change-workflow
description: How changes are made in the drafts-scripts repo, from finding existing helpers to committing and checkpointing main. Use this for every code or config change here, however small. That covers new Drafts actions, revisions to existing scripts (query letter, Fastmail, BVR, Content Pipeline), bug fixes, settings YAML or .yaml.tpl edits, tests, and build tooling. Also use it when the user wants to switch to the stable version, roll back, fix something on main, or asks about checkpoints or releases. Load it before writing the first line of code, not after.
---

# Drafts change workflow

Most work in this repo is quick: the user needs a script now, then refines it over a few rounds of real use in Drafts. Work comes in sprints of a week or two, followed by months of quiet. The workflow is built around that. Keep the loop fast, never commit a round that hasn't worked in Drafts, and keep `main` as a stable fallback the user can switch to at any moment.

Readability and modularity drive about 90% of the user's code choices. When in doubt, pick the version that is easier to read and easier to reuse.

## At the start of work

Run `bun run checkpoint`. If commits have settled, run `bun run checkpoint promote` without asking, then report it in one line, for example: "Moved main to 2026.10.002 (12 commits from the last sprint)." The settle rule is the judgment the user wants applied. Asking each time adds a question, not safety. A finished sprint usually becomes eligible during the quiet stretch, when nobody is committing, so the start of the next sprint is when to catch it. See [references/checkpoints.md](references/checkpoints.md) for the rule, why it is 3 days, and the two cases where main is held back.

Check the branch. Work normally happens on `dev`. If the user is on `main`, see "Working on main" below.

## 1. Size the change

- **Small (the default):** work directly on `dev`. This covers fixes, tweaks, and refinements to one script. It also covers a new self-contained action, since a new file can't break the actions the user already relies on. Example: "tag generated query letters with `query` or `query_manager`." Don't ask whether to branch for these.
- **Large:** create `feature/<name>` off `dev`. Use a branch when the change restructures code in `shared/` or a module's `core/` that several actions depend on, for migrations, or for anything that needs several test rounds before it is safe for daily use. The point of the branch is to keep dev usable while risky work is half done.

No feature-spec or feature-build pipeline for this repo. Changes are too small and too urgent for it.

## 2. Find what already exists before writing code

This repo has its own helpers for prompts, menus, settings, and messages, and the user expects them to be used. Writing a parallel version is the most common correction. A real example: Claude hand-built a yes/no prompt for Send to Fastmail when `DraftsUI.yesNoPrompt()` already existed.

For anything beyond editing a few lines you have already read, spawn an Explore agent first:

> Task: <what the change needs to do>. In /Users/dewittn/Programing/dewittn/Other/drafts-scripts, find existing code that already does any part of this. Search by each step the change performs (for example: building a slug, adding draft tags, prompting for a choice), not only by the feature's name. Check `Library/Scripts/shared/libraries/`, `Library/Scripts/vendor/nr.js`, `Library/Scripts/modules/*/utils/`, the module being changed, and sibling actions in `Library/Actions/<area>/`. For each match, return the function or class, its file:line, and one real call site showing how it is used. Say plainly if nothing fits.

Where things usually live:

| Need | Look at |
|---|---|
| Prompts, menus, yes/no, success and error messages | `shared/libraries/DraftsUI.js` (`buildMenu`, `yesNoPrompt`, `display*Message`) |
| Loading settings, new drafts, templates, tags | `vendor/nr.js` (`loadSettings`, `newDraft`, `fetchTemplate`, `appendTags`) |
| Service APIs | `shared/libraries/` (`nocodb.js`, `fastmail.js`, `bear.js`, `ulysses-v2.js`, `kutt.js`, `PushoverAlert.js`) |
| Pickers built from records, action menus | `shared/libraries/UIUtilities.js`, `ActionMenu.js` |
| Text helpers | `modules/cp/utils/TextUtilities.js`, `modules/bvr/utils/BVRUtilities.js` |
| How a similar action is put together | Sibling files in `Library/Actions/<area>/` |
| Test mocks | `Library/Tests/fixtures/mocks.js` |

Whether you use the agent or search yourself, search by what the new code does. Reading the module you're changing shows its own patterns but misses helpers that live elsewhere. For example, a tag change should look for existing tag and slug code (`TextUtilities.convertTitleToSlug()`), not just grep for "query".

If a helper almost fits, extend it and say so, rather than working around it. If you write something new that other scripts could use, put it where the next search would find it (`shared/libraries/` or the module's `utils/`).

## 3. Write it

- **Thin actions.** A file in `Library/Actions/` requires its modules, reads settings, calls a module class, and reports the result. Logic lives in a class under `Library/Scripts/modules/<area>/` or `shared/`, where it can be tested and reused. `Library/Actions/nr/send-to-fastmail.js` with `modules/nr/FastmailSender.js` is a good model.
- **Match the surrounding code.** Use small named functions with a one or two line comment saying what each does and why, guard clauses over nesting, and descriptive names. Polish with the `code-styling` skill once it works.
- **Config, not constants.** Settings go in `Library/Data/**/*.yaml`, and secrets go in `<name>.yaml.tpl` files. Never edit the generated `.json`. Read settings with `loadSettings("<file>.json")`.
- **Require paths** are always relative to `Library/Scripts/` (see CLAUDE.md).
- **Know the runtime.** Read `docs/reference/drafts-runtime.md` before touching code that updates the open draft, holds state, or switches workspaces. Every run starts from a fresh context, and Drafts writes the global `draft` back to the editor when a script step ends. Both have caused real bugs.
- **Airtable is legacy.** NocoDB is production. Don't invest in `airtable-v2.js`, and don't make gratuitous edits to it either, until the user decides whether to delete it.
- **New actions:** you can't create the action inside Drafts. Tell the user the action name and the Script step to add, copying the step from a sibling action.

## 4. Verify, then sync

1. `bun run test`. When pure logic changes, add or extend a unit test in `Library/Tests/unit/<area>/` (see `unit/nr/email-draft-test.js`). Tests reported as "needs Drafts" run through Eval Draft (step 5).
2. `bun run typecheck`. It fails only on errors that aren't in the baseline. Fix new ones. Don't add them to the baseline.
3. When both pass, run `bun run sync` without asking. It runs the full pipeline every time, which is intended. Don't strip steps to make it faster. If it fails with a 1Password socket error, see the build environment section of `docs/reference/drafts-runtime.md`.

If `bun run watch` is running, it already syncs every save. Mention it before switching branches, because a checkout would immediately sync that branch's code to the user's live library.

## 5. Test in Drafts

- **Logic with no UI:** run it through the Drafts MCP server with the Eval Draft probe (`docs/reference/drafts-runtime.md`), then trash the scratch draft.
- **Anything interactive** (prompts, menus, editor changes): give the user a short checklist: which action to run, on what kind of draft, and what should happen.

Expect a few rounds. The user often doesn't have the full picture until they use the script, so treat each round's feedback as normal refinement, not failure.

## 6. Commit when the user confirms a round works

When the user says a round works in Drafts, commit right away without asking, following the global `commit` skill. Make one commit per working round, in the gitmoji style of `git log` (for example "✨ Ask before attaching the signature in Send to Fastmail"). Never commit a round that failed or hasn't been tried. Changes that never reach Drafts (docs, build tooling, tests) can be committed once their own checks pass.

- **On dev:** commit and push, with no PR. The global commit skill opens a PR for any branch other than main. Skip that here, because main only moves through checkpoints.
- **On a feature branch:** commit and push each working round. When the feature is done, run a checkpoint on `dev` first, so main holds the newest settled work before the riskiest change lands. Then open a PR into `dev`, merge it with a merge commit, and delete the branch (as with PRs #4 to #8).

Then run `bun run checkpoint` and promote if anything has settled, as at the start of work. If nothing has settled, give the date the script reports ("these settle on Oct 20"), but don't promise to follow up. A later session won't remember the promise. The start-of-work check in whichever session runs next does the promotion.

Keep the report short: what was committed, and the checkpoint status. Don't explain the workflow back to the user (why there's no PR, why main didn't move). They wrote these rules.

## Working on main

Main is where the user goes when dev is broken and they need a working script. They also go there before work when a change to a production workflow, such as recording attendance at school, is still in testing and they need the stable version in their pocket. The whole buffer exists for that moment.

1. Stop `bun run watch` if it is running.
2. If dev has uncommitted work, stash it (`git stash push -u -m "<what it is>"`) so it survives the switch, and say so.
3. `git switch main`, then `bun run sync`. Main may still use the older Gulp pipeline. `bun run sync` works on both.
4. Commit a fix on main the same way as on dev, push it, then merge main into dev right away (`git switch dev && git merge main`). This keeps main an ancestor of dev. Otherwise checkpoints can't fast-forward and the fix gets lost.
5. Run `bun run sync` again after switching back to dev (and `git stash pop` if you stashed), so iCloud matches the checkout.

If main itself turns out to be broken, for example a seasonal script that settled months ago but had not run since, fall back further to an earlier checkpoint tag: `git switch --detach <tag>`, then `bun run sync`. `git tag --sort=-creatordate` lists them, newest first.

## Delegating

Opus works directly in the repo, including small edits. For long, multi-step work, the user prefers an Opus worker plus a separate review pass on its diff before reporting back. Workers don't see project memory, so give them this skill's path and `docs/reference/drafts-runtime.md` in the prompt.
