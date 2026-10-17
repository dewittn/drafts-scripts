# Checkpoints

`main` is the stable fallback for `dev`. If something on dev breaks while the user needs a working script, they switch to main, sync, and keep going. A checkpoint moves main forward to the newest dev commit that has settled and tags it.

## The settle rule

A commit has settled when:

1. it is at least 3 days old (committer date), and
2. every later commit that changed one of the same files within 3 days of it has settled too.

Main can only move to the end of an unbroken run of settled commits, because it fast-forwards along dev's history. Docs-only commits (`docs/`, `.claude/`, `types/`, top-level `.md`) settle at once. A merged PR counts as one commit, dated when it landed on dev.

`bun run checkpoint` applies the rule and prints what has settled, what is holding the rest back (the chain of commits and the shared file), and when more will settle if nothing else changes. `bun run checkpoint promote` pushes the settled commit to `origin/main`, fast-forwards local `main`, and creates and pushes a CalVer tag (`YYYY.MM.NNN`) whose message lists the included commits. It never checks out a branch, so iCloud is untouched. `promote <sha>` promotes a commit the user picked by hand and warns if it has not settled.

## Why 3 days, and why the chain

Analysis of all 298 non-merge commits (2021-08 to 2026-10). Claude-assisted work starts 2025-09-17.

| Fix landed within | Before Claude | With Claude |
|---|---|---|
| 1 day of the last change to the same file | 22% | 60% |
| 3 days | 25% | 78% |
| 14 days | 48% | 84% |

With Claude, bugs surface fast, while the user is still revising the script. Moving from 3 to 14 days catches only about 6% more. The remaining fixes came 5 to 12 months later, when a seasonal BVR script (attendance, practice plan, Team settings) ran again. No settle window catches those. CalVer tags keep older checkpoints reachable for that case.

Claude-era work comes in sprints of about 12 days and 37 to 68 commits, separated by 4 to 5 months of quiet. Replaying both sprints day by day:

- **Age alone** would have moved the 2026-10-13 query-letter commits to main on 10-16 without their 10-15 fixes, including the duplicate-text bug.
- **Age plus the chain** holds main at the end of the previous sprint while a sprint is active, because the same scripts keep changing. About 3 days after the sprint goes quiet, the whole sprint settles at once.

That second behavior is the goal. During a sprint, main is the last known-good state. After it, main catches up.

## When to run it

- **When starting work**, before the first edit. In the sprint pattern the quiet window passes with no commits, so this is when a finished sprint is usually first eligible. Offer it before new edits pile on top.
- **After each commit.**

Mention a checkpoint only when commits have settled and you have not already offered them in this session. Promote only after the user says yes.
