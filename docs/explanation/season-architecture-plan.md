# Season architecture plan

Status: being built on `feature/season-architecture` (off `dev`). Written
2026-10-18 as a high-level overview; the "Status and how to resume" section
below is kept current as work lands.

## Status and how to resume

Last updated 2026-10-18 (evening). The branch is what the live Drafts
library runs; all three old teams are migrated to team files and
`msg-basketball` has its `2026-winter` season.

**Done, reviewed, synced to Drafts:**

- Step 1, build cleanup, on `dev`: rendered YAML deleted after sync, inject
  skip by content hash plus output hash, `data` pull never fetches built or
  committed JSON, templates named `<name>.yaml.tpl`, Claude deny rules.
- Step 2, storage: `teams/<id>.json` per team, `bun run bvr:backup`,
  two-way `bun run bvr:migrate` with `--verify` and `--reverse --out`,
  Season/PracticePlan/Game reading from the team file with a legacy fallback.
- Step 4, config layering: `staff.yaml.tpl` (the only file with contact
  details), `levels/ms.yaml` and `levels/us.yaml`, `forms.yaml`, per-team
  overrides in `teams.yaml`; the three per-team settings folders are gone.
- Step 3, partly: Start New Season prompts for season ID, start date and
  form links, and completes a season the migration pre-created. Edit Season
  changes name, dates and links. Submit Game Report asks for a missing link.

- Shared form links per term: `formLinks.json`, keyed
  `<year>-<fall|winter|spring>`, used by every team in that term, with a
  per-season override slot. See "Form links" in
  `docs/reference/bvr-team-file.md`. Checked in Drafts: pending the first
  Edit Season run on soccer and basketball after the 2026-10-18 sync.

**Done on the branch, not yet checked in Drafts:**

- Step 3 remainder: Start New Season asks who gets attendance and score
  messages (initials prefilled from the team default, unknown ones named and
  asked again; only lists that differ are saved as the season's
  `recipients`), then keeps the roster draft in use or starts a new one from
  `attendance.md` and opens it. Edit Season shows both lists and the roster
  draft, with a switch to start a new one. `Team.attendanceDraftID` prefers
  the season's roster draft over `teams.yaml`'s.

**In flight:** nothing.

**Not started:**

- Step 5: `bun run new-team <id> --sport --level --abbr` scaffold. Derive it
  from what adding `msg-basketball` by hand touched: `teams.yaml`,
  `sports.yaml`, `Templates/bvr/<id>-practice-plan.md`,
  `Templates/bvr/<id>-game-day-project.mustache`, plus the manual checklist
  (attendance draft and its ID in `teams.yaml`, calendar named by `abbr`,
  Things project template, the two Shortcuts that take `abbr`).
- Later cleanup, after a full season on team files: drop `startDate` from
  `teams.yaml` (seasons carry their own), stop pushing `records.json` and
  `practicePlans.json` and retire them, retire the `Score Report` items in
  1Password (nothing reads them), remove Gulp.
- Finish: open a PR from the branch into `dev`, merge with a merge commit,
  delete the branch, then `bun run checkpoint`.

**Working rules that held throughout:** code is written by Opus builders and
reviewed before sync; the rendered settings files are never read; nothing on
the branch modifies the old `records.json` or `practicePlans.json`; backups
live in `~/Backups/drafts-bvr/`; before any `bun run sync`, confirm which
branch the shared checkout is on, because builders switch it.

## Decisions so far

- Form entry IDs stay the same between seasons; only the form URL changes.
  No HTML fetching needed.
- One JSON file per team holding all of that team's seasons, not one file
  per season.
- The secrets goal is keeping PII (phone numbers, emails) out of Claude Code's
  reach, not disk hygiene for its own sake. Delete rendered YAML after sync and
  use a content hash to keep the inject skip. No scratch build directory.

Decided while building step 2 (2026-10-18; details in
[`docs/reference/bvr-team-file.md`](../reference/bvr-team-file.md)):

- Migrated seasons are named `<year>-<season>` from `teams.yaml`
  (`2026-fall`). Start New Season accepts any `<year>-<name>`, so a winter
  sport can use `2026-winter` or `2026-27`; the leading year is required
  because the old files key seasons by it. The display label is derived from the ID
  (`2026 Fall`) and gets its own template tag, `current_season_label`, which
  now titles the season record draft. `current_season` is the ID.
- The team file wins whenever both sides hold the same game or practice plan,
  in both directions. A forward re-run only adds what the team file lacks and
  keeps an existing `currentSeason`. So an edit made on `main` to a game the
  team file already has is not carried forward; `--verify` lists it.
- Reverse writes only to an `--out` folder, never over the live files, because
  the migration must never rewrite its inputs. Handing data back to `main` is
  a backup and a copy of two files. Forward backs up on its own before writing.
- The teams folder is a `teamFilesDir` key in `settings.yaml.tpl`, read by both
  the Drafts scripts and `bvr:migrate`. The build's push excludes that folder
  entirely: team files are written in iCloud and only pulled locally.
- An unusable team file (half-synced, wrong schema) stops the action or the
  migration. It never falls back to `records.json` and is never overwritten.
- Residual risk: `records.json` and `practicePlans.json` are still pushed.
  `sync` and the watch rebuilds pull them first, but a game recorded on
  another device that iCloud has not delivered to the Mac yet, or written in
  the seconds between pull and push, can still be overwritten by the older
  local copy. Same exposure as on `dev`; it shrinks to nothing once every team
  is on a team file and the old files stop changing.
- Only the season whose year matches the `teams.yaml` `startDate` gets that
  date. Older seasons store null; Jan 1 of their year is used only to choose
  `currentSeason`. If every season is still ahead, the earliest upcoming one
  is current.
- A team with no team file keeps the old behavior. Start New Season creates a
  team file only for a team with no history in the old files, so an
  unmigrated team's history is never hidden behind an empty team file.
- "Migrate Current Season" stays for unmigrated teams. On a team file it only
  says there is nothing to migrate, since `bvr:migrate` converts the 2024
  bare-array seasons.
- `endDate`, `recipients`, and `attendanceDraftID` are in every season entry
  but nothing reads them yet. Step 3 fills them.

Decided while building step 4, the config layering (2026-10-18, before the
basketball team starts on 2026-10-30):

- `staff.yaml.tpl` is the only file with contact details: `people`, keyed by
  initials, each with only the `name`, `cell`, or `email` some message or tag
  uses. That includes the head coach (`ME`), so `hc_name` and `hc_email` now
  come from `headCoach: ME` in `settings.yaml.tpl`, and the attendance office
  (`ATT`, from `attendanceOffice`). `settings.yaml.tpl` keeps its name and
  role but no longer holds a secret.
- `forms.yaml` is plain YAML, not a template: the two field maps
  (`ms-score-report`, `varsity-score-report`) with titles and entry IDs. No
  URLs, since the URL is per season.
- A season entry holds `formURLs: { <form name>: url }` instead of one
  `formURL`, because MS Ultimate submits two forms. Start New Season asks for
  each link (blank skips); Submit Game Report asks for any still missing,
  saves it, and skips a form left blank with a message. A pasted
  `.../viewform?usp=...` link is cut back to the base link.
- Form links turned out to be per term, not per team: the athletic
  department issues one link per form for fall, winter, and spring each
  year, shared by every team in that term. They live in a runtime
  `bvr/formLinks.json` keyed by `<year>-<term>`; a season's own `formURLs`
  stays as an override and as the home for seasons with no term (`2026-27`).
  Links already saved on a season move up to the term the first time they
  are used in Drafts.
- `levels/ms.yaml` and `levels/us.yaml` take today's MS Girls Soccer and
  Varsity Ultimate values. In teams.yaml a team overrides any part: objects
  merge, lists replace. MS Ultimate overrides attendance recipients, its
  score-text list, and its forms.
- Tags and template files are derived (recap tag `<defaultTag>/game/recap`,
  the three game templates, `bvr/<id>-game-day-project.mustache` when it
  exists). Only what does not fit is in teams.yaml: MS Girls Soccer's
  `recapTag`, Varsity Ultimate's `templates.welcomeLetter`. Practice-plan tags
  are now read from teams.yaml; the values there were changed to what each
  team's old `templateSettings` used, since that was the live source (MS Girls
  Soccer had two different values).
- teams.yaml is the single source of `attendanceDraftID`. MS Girls Soccer's
  came from its old `attendanceSettings` and is now in teams.yaml. Basketball
  has none yet.
- A check before deleting the nine per-team templates ran TeamConfig on the
  raw `op://` references and matched them field for field (recipients, cc,
  bodies, subject, forms, tags, template files). The only addition is the
  `attendance_email` tag for MS Girls Soccer, which no template it uses reads.
- The old per-team folders still hold rendered `.json` copies locally and in
  iCloud (`data` pulls them back, so a local delete alone does not stick).
  Nothing reads them. Delete `Library/Data/bvr/{ms-ultimate,msg-soccer,us-ultimate}/`
  in iCloud and locally to clear the contact details they hold.
- Claude deny rules: the rendered `staff.json` is covered by the existing
  `Library/Data/**/*.json` rule, and `Read(Library/Data/**/staff.yaml)` covers
  the rendered YAML.

## What starting a season costs today

Every season-start commit since 2024 touched the same handful of things. Nothing
else in the BVR config moves between seasons.

| What changes | Where it lives now | How it gets changed |
|---|---|---|
| Season start date | `teams.yaml` → `startDate` | Edit YAML, `bun run sync` |
| Score-report form URL | `gameReportSettings.yaml.tpl` → `op://BVR/Score Report/<ABBR>` | Edit 1Password item, `bun run inject --force`, sync |
| Who gets absence and score texts | `attendanceSettings.yaml.tpl`, `gameReportSettings.yaml.tpl` recipient lists | Edit `.yaml.tpl`, sync |
| Season record draft | `records.json` → `seasonRecordDraftID` | "Start New Season" action creates it |
| Attendance draft (when recreated) | `teams.yaml` **and** `attendanceSettings.yaml.tpl` (duplicated) | Edit both, sync |
| Coaching-year counters (`hc_year`, `hc_years_coaching`, `ac_years_coaching`) | `settings.yaml.tpl`, `templateSettings.yaml.tpl` | Edit `.yaml.tpl`, sync (often forgotten) |
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
  settings.yaml.tpl         global: workspace, coaching draft, file names,
                            headCoach and attendanceOffice initials              (rarely)
  sports.yaml               per sport: score picker ranges                        (new sport only)
  staff.yaml.tpl            contact directory keyed by initials, from 1Password;
                            the only file with contact details                    (when staff changes)
  forms.yaml                school-wide score forms: field maps and entry IDs     (when the school changes the form)
  teams.yaml                per team: id, name, abbr, sport, level, calendar,
                            defaultTag, attendanceDraftID, assistantCoaches,
                            templateTags, practice-plan tags, and overrides of
                            its level (attendance, gameReport, forms, recapTag,
                            templates)                                            (new team only)
  levels/ms.yaml, us.yaml   per level: attendance and score messages (type,
                            recipients by initials, text), forms to submit        (rarely)
  teams/<team-id>.json      per team, written by Drafts, never in git:
                            currentSeason, then one entry per season with
                            startDate, endDate, formURLs, recipients (initials),
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
- **Secrets move out of per-team files into a directory.** `staff.yaml.tpl` renders
  initials to cell numbers and emails from 1Password once. Team and season
  config then names people by initials (`recipients: [AG, HM]`), which is not
  secret and can live in a YAML or be edited from inside Drafts. Changing who
  gets absence texts stops being a secret-template edit.
- **The score form becomes two things.** The *field map* (titles and entry
  IDs) is school-wide and stable, so it goes in `forms.yaml.tpl` once instead of
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

With the layering above, a new team needs no `.yaml.tpl` files of its own. Today it
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
  (`.build/inject-manifest.json`) mapping each template path to a hash of its
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
3. **"Start New Season" action** (branch): the guided flow above. Form links
   are done (asked at Start New Season and Submit Game Report), and an Edit
   Season action changes the current season's name, dates, and links later;
   recipients and the attendance draft remain.
4. **Config layering** (branch): `staff.yaml.tpl`, `forms.yaml.tpl`, levels; collapse the
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
  in their `attendanceSettings.yaml.tpl`, which looks like a copy-paste leftover
  that the `teams.yaml` value papers over.
- `hc_year` style counters could be derived from a `coachingSince` year in the
  season or team file instead of being hand-incremented.
- `Attendance` and the shortcut name both spell it "Attendace". Harmless, but
  the shortcut name is an external contract, so rename carefully if at all.
