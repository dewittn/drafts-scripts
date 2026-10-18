# Season architecture plan

Status: draft for review, 2026-10-18, revised the same day after discussion.
High-level overview, not an execution plan.
Proposed branch: `feature/season-architecture` off `dev`.

Decisions so far:

- Form entry IDs stay the same between seasons; only the form URL changes.
  No HTML fetching needed.
- One JSON file per team holding all of that team's seasons, not one file
  per season.
- The secrets goal is keeping PII (phone numbers, emails) out of Claude Code's
  reach, not disk hygiene for its own sake. Delete rendered YAML after sync and
  use a content hash to keep the inject skip. No scratch build directory.

## What starting a season costs today

Every season-start commit since 2024 touched the same handful of things. Nothing
else in the BVR config moves between seasons.

| What changes | Where it lives now | How it gets changed |
|---|---|---|
| Season start date | `teams.yaml` → `startDate` | Edit YAML, `bun run sync` |
| Score-report form URL | `gameReportSettings.tpl` → `op://BVR/Score Report/<ABBR>` | Edit 1Password item, `bun run inject --force`, sync |
| Who gets absence and score texts | `attendanceSettings.tpl`, `gameReportSettings.tpl` recipient lists | Edit `.tpl`, sync |
| Season record draft | `records.json` → `seasonRecordDraftID` | "Start New Season" action creates it |
| Attendance draft (when recreated) | `teams.yaml` **and** `attendanceSettings.tpl` (duplicated) | Edit both, sync |
| Coaching-year counters (`hc_year`, `hc_years_coaching`, `ac_years_coaching`) | `settings.tpl`, `templateSettings.tpl` | Edit `.tpl`, sync (often forgotten) |
| Roster | Attendance draft body | "Update Roster" action |

Three structural problems sit underneath that list.

1. **Season state is scattered across config and runtime data.** The start date
   is build-time config, the record draft ID is runtime data written by Drafts,
   and the form URL is a secret. Starting a season means touching all three
   layers with three different tools. The "Start New Season" action can only
   reach the runtime layer, which is why it only creates the record draft.
2. **A season is identified by the calendar year.** `Season.currentSeasonID`
   is `new Date().getFullYear()`, and practice-plan IDs are `<year>W<n>`. That
   works for fall and spring sports. A winter sport that runs November to
   February gets split into two "seasons" on January 1: the record draft, the
   season record array, and the practice-plan week counter all reset. This
   matters right now because basketball is a winter sport.
3. **Per-team folders duplicate school-wide config.** The varsity score form
   block (same URL slot, same nine entry IDs) is copied into all three team
   folders. Message formats are copied too. The things that genuinely differ
   between middle school and upper school, mainly who gets notified and whether
   the message is a text or an email, are a small fraction of each file.

## Target shape

Split BVR configuration into layers by how often each changes and who changes it.

```
Library/Data/bvr/
  settings.tpl              global: workspace, coaching draft, head coach tags   (rarely)
  sports.yaml               per sport: score picker ranges                        (new sport only)
  staff.tpl                 contact directory keyed by initials, from 1Password   (when staff changes)
  forms.tpl                 school-wide score forms: field maps and entry IDs     (when the school changes the form)
  teams.yaml                per team: id, name, abbr, sport, level, calendar,
                            tags, template files, which form it submits to        (new team only)
  levels/ms.yaml, us.yaml   per level: message type, default recipient roles      (rarely)
  teams/<team-id>.json      per team, written by Drafts, never in git:
                            currentSeason, then one entry per season with
                            startDate, endDate, formURL, recipients (initials),
                            attendanceDraftID, seasonRecordDraftID, games[],
                            practicePlans{}                                      (every season, from inside Drafts)
```

The key moves:

- **One runtime file per team, all seasons inside.** Each team's file holds a
  `currentSeason` pointer and a `seasons` map keyed by season ID. Each season
  entry carries every variable that shifts season to season plus that
  season's game record and practice-plan IDs, so `records.json` and
  `practicePlans.json` both fold into it. It is runtime data in iCloud, like
  `records.json` is today, so Drafts can write it. The "Start New Season"
  action adds a season entry and moves the pointer. The file itself is
  created once, by the new-team scaffold or lazily on first use, so no
  per-season file creation is ever needed. The season ID becomes an explicit
  string such as `2026-27` or `2026-fall`, decoupled from the calendar year,
  which fixes the winter-sport problem and the practice-plan week collision in
  one stroke.
- **Secrets move out of per-team files into a directory.** `staff.tpl` renders
  initials to cell numbers and emails from 1Password once. Team and season
  config then names people by initials (`recipients: [AG, HM]`), which is not
  secret and can live in a YAML or be edited from inside Drafts. Changing who
  gets absence texts stops being a secret-template edit.
- **The score form becomes two things.** The *field map* (titles and entry
  IDs) is school-wide and stable, so it goes in `forms.tpl` once instead of
  three times. The *URL* for this season goes in the team file's season
  entry, pasted in when the season starts. The athletic department copies the
  form each year, so the entry IDs stay put and only the URL moves. The form
  URL stops being a 1Password item.
- **Levels replace copy-paste.** A `level` key on each team (`ms` or `us`)
  pulls in that level's notification workflow. Middle school texts assistant
  coaches; upper school emails the attendance office with coaches on copy. Team
  files only override what differs.

## "Start New Season" becomes a real action

One guided flow inside Drafts, no rebuild, no 1Password:

1. Pick the team (or infer it from the open draft's tag, as today).
2. Prompt for the season label and start date (date picker, defaulting to the
   coming Monday). End date optional.
3. Prompt for this season's form URL (paste from the AD's email).
4. Confirm notification recipients by initials, prefilled from the level
   defaults and last season's file.
5. Attendance draft: reuse last season's, or create one from
   `attendance.md` and hand off to "Update Roster".
6. Create the season record draft, as the action does now.
7. Add the season entry to `teams/<team>.json` and set `currentSeason`.

Everything downstream (`Game`, `Attendance`, `PracticePlan`, `Season`) reads
from the team file's current season instead of from `teams.yaml` +
`records.json` + `practicePlans.json` + `gameReportSettings.json`.

## A new team or sport: a dev-side scaffold

A new sport is the one case that still needs the build pipeline, because it
needs new files, templates, and tags. Make it one command:

```
bun run new-team <team-id> --sport basketball --level us --abbr VBB
```

It would add the `sports.yaml` entry if the sport is new, append the team to
`teams.yaml`, create `<team-id>-practice-plan.md` and the game-day
`.mustache` from a starter, and print the manual checklist that code cannot
do: create the attendance draft, create the team calendar named by `abbr`,
add the Things project template, add the `Score Report/<ABBR>` 1Password item
if you keep forms there, and confirm the "Mark Attendance As Complete" and
"Complete Game Day Tasks" shortcuts handle the new `abbr`. Then run the
in-app "Start New Season" for the first season.

With the layering above, a new team needs no `.tpl` files of its own. Today it
needs three.

## Storage: one JSON file per team, not SQLite

Drafts has no SQL API. The bundled `types/drafts.d.ts` lists no database
class, and `FileManager` offers only `readString`, `readJSON`, and their write
counterparts. The realistic options were:

- **Per-team JSON files** (chosen). Fits the existing `DataFile` class
  unchanged, works offline at a game, flows back to the repo through the
  existing `bun run data` step, and keeps everything about one team in one
  place. A team accumulates roughly 17 KB a season, so a file stays small for
  a decade. If one ever grows awkward, retired seasons can be moved to an
  archive file without changing the shape of the current one.
- **NocoDB.** Already the production store for the Content Pipeline, queryable
  across seasons, and it would make a school-wide history table trivial. The
  cost is a network dependency during the moments you use these scripts
  (sideline, bus, gym with bad reception) and a second write path to keep
  consistent. Worth revisiting only if you want cross-season reporting.

Migration is mechanical: one script walks `records.json`
(`teamID → year → { seasonRecordDraftID, seasonRecordData }`) and
`practicePlans.json` (`teamID → <year>W<n> → draftID`) and writes one team
file each, inferring the season label from the year plus the team's
`season: fall|spring` value. Keep the old files in place until the new code
has run a few game days.

## Build pipeline: keep rendered PII off the disk Claude Code reads

The goal is that the phone numbers and emails rendered from 1Password are not
sitting in the repo where Claude Code can read them. Two changes:

- **Delete rendered `.yaml` after `push`.** `sync` becomes data, inject,
  yaml2json, push, clean. The watcher's rebuild-from-tpl path does the same.
- **Replace the mtime skip with a content hash.** `inject` currently skips a
  template whose `.yaml` is newer than its `.tpl`, which can't work once the
  `.yaml` is gone. Comparing against the `.json` instead is fragile, because
  the `data` step pulls those files back from iCloud and refreshes their
  mtimes on every sync. So `inject` keeps a small gitignored manifest
  (`.build/inject-manifest.json`) mapping each `.tpl` path to a hash of its
  content, and re-renders when the hash differs, the manifest entry is missing,
  the `.json` is missing, or `--force` is given. Same speed as today, same
  1Password behavior as today.

What this does and does not cover, so the safeguards can be set accordingly:

- The rendered `.json` files under `Library/Data/` carry the same PII and
  stay, because rsync pushes them and Drafts reads them. The iCloud copies are
  on the same Mac. Deleting the YAML removes the human-friendly copy, not the
  only copy.
- Deny rules now live in `.claude/settings.json` (committed, so they apply
  on every machine): the four generated `.yaml` names, every `.json` under
  `Library/Data/`, and the Drafts iCloud `Library/Data` path. Before this the
  "work from the templates" instruction was doing the protecting. A `Read`
  deny does not stop `cat` in Bash, so the deletion is still the stronger
  guard for the YAML, and the deny rules are the guard for the JSON.
- The staff-directory change in the config layering shrinks the PII to one
  rendered file, `staff.json`, which makes the deny list short and the blast
  radius of a slip small.

Both pipeline changes are small, self-contained, and can land on `dev` ahead
of the branch.

## Keeping `main` a working fallback while this is tested

The new storage is a one-way gate if it is done carelessly: once games are
recorded into `teams/<id>.json`, switching back to `main` puts the old code in
front of data it cannot see. Three rules keep the gate two-way for the whole
test period.

1. **Never delete or rewrite the old files on the branch.** `records.json`
   and `practicePlans.json` stay in iCloud untouched. The migration script
   reads them and writes the new team files beside them. `main` keeps
   working on the old files the moment you switch back.
2. **Back up before the first migration, and before each test round.**
   A `bun run bvr:backup` command copies the runtime JSON under the iCloud
   `Library/Data/bvr/` into a timestamped folder outside the repo
   (`~/Backups/drafts-bvr/<date-time>/`). It is a plain copy, so restoring is
   dragging files back. Run it before `bun run sync` on the branch and before
   each game day while testing.
3. **The migration runs both ways.** The same script that builds team files
   from `records.json` + `practicePlans.json` can rebuild those two files
   from the team files (`bun run bvr:migrate --reverse`). If a game day's
   data lands only in the new file and you then need `main`, one reverse run
   puts it where `main` looks. This is cheap because both directions are pure
   data transforms, and it means the branch can be abandoned at any point
   without losing a recorded game.

Also: stop `bun run watch` before switching branches. A checkout under watch
syncs that branch's code to iCloud immediately, and the two branches disagree
about which files are the source of truth.

## Suggested order

1. **Build cleanup** (dev, small): hash manifest, delete rendered YAML after
   push, deny rules for the rendered files.
2. **Team file + explicit season ID** (branch): `bvr:backup` and the
   two-way `bvr:migrate` first, then the new `Season` storage with
   `PracticePlan` and `Game` reading from it. This is the piece basketball
   needs before the first practice.
3. **"Start New Season" action** (branch): the guided flow above.
4. **Config layering** (branch): `staff.tpl`, `forms.tpl`, levels; collapse the
   three team folders.
5. **`bun run new-team` scaffold** (branch): last, because it generates the
   shapes settled in step 4.

Step 2 is the minimum for a working basketball season. Steps 3 to 5 make the
next one cheap.

## Smaller things noticed on the way

- `Season.currentSeasonData` checks `typeof x == "array"`, which is never
  true, so the auto-migration branch is dead code.
- `attendanceDraftID` is read from `teams.yaml` first and the team's
  `attendanceSettings` second. `ms-ultimate` and `msg-soccer` share the same ID
  in their `attendanceSettings.tpl`, which looks like a copy-paste leftover
  that the `teams.yaml` value papers over.
- `hc_year` style counters could be derived from a `coachingSince` year in the
  season or team file instead of being hand-incremented.
- `Attendance` and the shortcut name both spell it "Attendace". Harmless, but
  the shortcut name is an external contract, so rename carefully if at all.
