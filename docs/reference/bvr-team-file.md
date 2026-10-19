# BVR Team File

Status: introduced 2026-10-18 on `feature/season-architecture`, step 2 of
[the season architecture plan](../explanation/season-architecture-plan.md).

Each BVR team has one runtime file holding all of its seasons. It replaces
`records.json` and `practicePlans.json` for teams that have one. Drafts writes
it, it lives in iCloud beside the old files, and it is never in git.

```
<Drafts>/Library/Data/bvr/teams/<teamID>.json
```

The folder name comes from `teamFilesDir` in `Library/Data/bvr/settings.yaml.tpl`.
The Drafts scripts read it through `BVR.teamFilePath()`, and `bvr:migrate`
reads the same key from the template.

## Schema (version 1)

```json
{
  "schemaVersion": 1,
  "teamID": "msg-soccer",
  "currentSeason": "2026-fall",
  "seasons": {
    "2026-fall": {
      "label": "2026 Fall",
      "startDate": "2026-08-31",
      "endDate": null,
      "formURLs": {},
      "recipients": null,
      "attendanceDraftID": null,
      "seasonRecordDraftID": "0A1B2C3D-...",
      "games": [],
      "practicePlans": { "W1": "4E5F6A7B-..." }
    }
  }
}
```

| Key | Type | Meaning |
|---|---|---|
| `schemaVersion` | `1` | Bumped when the shape changes incompatibly |
| `teamID` | string | Matches `id` in `teams.yaml` |
| `currentSeason` | string or null | Key into `seasons`. Every action works on this season |
| `seasons` | object | One entry per season, keyed by season ID |

Each season entry:

| Key | Type | Meaning |
|---|---|---|
| `label` | string | Display name, used by the `current_season_label` template tag |
| `startDate` | `YYYY-MM-DD` or null | Week 1 of the practice-plan counter. Null falls back to `startDate` in `teams.yaml` |
| `endDate` | `YYYY-MM-DD` or null | Not read yet. Reserved for the guided Start New Season flow |
| `formURLs` | object | Form name (from `forms.yaml`) to a link for this team's season only, overriding the term's shared link (see "Form links"). Usually empty. Files written before this key carry `formURL: null`, which reads as `{}` and is dropped on the first save |
| `recipients` | object or null | `{ attendance: [initials], gameReport: [initials] }`, either key optional: who gets this season's attendance and score messages, replacing the team's lists (`teams.yaml`, else the level). Only the lists change; message type, text, cc, and subject stay with the level or team, so for an email level (`us`) `attendance` replaces `recipients` and leaves `ccRecipients` alone. Null (the usual case) keeps the defaults, so a change to the level still reaches the team |
| `attendanceDraftID` | string or null | The season's roster draft. Record Attendance and Update Roster use it first, then `attendanceDraftID` in `teams.yaml` |
| `seasonRecordDraftID` | string or null | The season record draft. Copied verbatim from `records.json`, so an old `""` stays `""` |
| `games` | Game[] | Exactly what `Game.toJSON()` writes, unchanged from `records.json`. Matched by `draftID`; a game without one is matched by its whole content, and repeats keep their count |
| `practicePlans` | object | Week key (`W7`) to practice plan draft ID |

## Season IDs

A season ID is an explicit string, decoupled from the calendar year.

- Migrated seasons are `<year>-<season>`, with `season` from `teams.yaml`
  (`2026-fall`, `2025-spring`). A team without `season` gets the bare year.
- Start New Season accepts any `<year>-<name>`, so a winter sport can use
  `2026-winter` or `2026-27`. A name without a leading year is refused and the
  prompt asks again, because the old files key seasons by that year.
- The label is derived from the ID: `2026-fall` reads `2026 Fall`. Any other
  shape is its own label.
- The old code keys seasons by calendar year. A reverse run files each season
  under the year its ID starts with, so `2026-27` lands under `2026`.

## Validity

A team file is usable only if it is a JSON object with `schemaVersion: 1`, a
non-empty `teamID`, a `seasons` object, and a `currentSeason` that is null or
a string. A half-synced iCloud copy reads as null or empty and fails this.
`TeamFileStore.validate` (Drafts) and `teamFileProblem` (`bvr:migrate`) make
the same checks, pinned by `Library/Tests/fixtures/bvr/schema-cases.json`.

- In Drafts, an unusable team file stops the action with an error. There is
  no fallback to `records.json` and nothing is written. `TeamFileStore` also
  refuses to save anything that would not load back.
- `bvr:migrate` stops before backing up or writing if any team file is
  unusable.

## How the Drafts scripts choose storage

`Season` picks the storage once per run, and `PracticePlan` and `Game` go
through it.

- **Team file exists:** read and write it. The `current_season` template tag
  is the season ID (`2026-fall`) and `current_season_label` is the label.
- **No team file:** behave as before against `records.json` and
  `practicePlans.json`, and show one info message saying the team has not been
  migrated. `current_season` is the year and so is `current_season_label`.

A team file with no current season (`currentSeason: null`) stops Record Game
Score, Submit Game Report, and both practice plan actions before any prompt,
with a message to run Start New Season. The season template tags render empty.

Start New Season with the name of a season that already exists completes it
instead of refusing: it becomes current, keeps its own start date (or takes
the prompted one), and gets a season record draft if it has none. This covers
a season `bvr:migrate` created from `teams.yaml` before its first game. Only a
season that is current and already has a draft is reported as existing.
Practice plan actions on a season with no start date, on a team with none in
`teams.yaml` either, stop with a message instead of counting weeks.

Start New Season also asks for each score-form link the team submits (from
its level or `forms` in `teams.yaml`) that the season's term does not share
yet, and saves the ones given for the term. Completing an existing season
works the same way. A link still missing at Submit Game Report is asked for
there.

Then it asks who gets attendance and score messages: two fields of
comma-separated initials, prefilled with the team default. Unknown initials
are named and the prompt asked again, up to three times. A blank field means
the default. Only a list that differs from the default (in any order) is
saved in `recipients`; otherwise `recipients` stays null.

Last comes the roster draft. If the team has one in use (the current
season's, else `teams.yaml`'s), it asks whether to keep it for the new season
or start a new one; Keep is the default, and cancelling keeps it too. A new
one is made from `bvr/attendance.md` (override: `templates.attendance` in
`teams.yaml`), tagged with the team's `defaultTag`, titled
`# Attendance: <abbr> <season label>` (Update Roster needs a year in the
title), with its `_For:` line set to today, and opened in the editor. The
template fills these in itself with the `[[team_abbr]]`, `[[season_label]]`,
and `[[date|%Y-%m-%d]]` tags, so an override template needs them too. A team
with no roster draft gets a new one without being asked. Completing an
existing season asks only if that season has no roster draft.

## Form links

The athletic department issues one link per score form per term each year,
and every team playing that term uses it. So links are shared per term, in
one runtime file beside the team files:

```
<Drafts>/Library/Data/bvr/formLinks.json     (name from formLinksFile in settings.yaml.tpl)

{
  "schemaVersion": 1,
  "terms": {
    "2026-fall":   { "varsity-score-report": "https://docs.google.com/forms/d/e/..." },
    "2026-winter": { "varsity-score-report": "https://docs.google.com/forms/d/e/..." }
  }
}
```

- **Term.** A season's term is its ID when the ID is `<year>-fall`,
  `<year>-winter`, or `<year>-spring` (any case, stored lowercase). Any other
  ID (`2026-27`) has no term, and its links live on the season, in
  `formURLs`. Teams on the old files also keep links on their
  `records.json` season.
- **Lookup order** when a form is submitted: the season's own `formURLs`
  entry (an override), then the term's shared link, then a prompt. A link
  given at the prompt is saved for the term when the season has one, else on
  the season.
- **Overrides** exist only if one is already in a team file; nothing in
  Drafts creates one. Edit Season changes an override in place.
- **Moving older links up.** A link saved on a season before sharing existed
  moves to the term the first time the season's links are used (Submit Game
  Report, Start New Season, Edit Season) if the term has none for that form.
  It is then removed from the season, with one save of each file. A season
  link that differs from the term's stays, as an override. The migrate
  scripts never read or write `formLinks.json`; this happens only in Drafts.
- **Validity and the build.** The same rules as team files: a missing file
  starts empty and is written on first save, an unusable one stops the
  action, and `bun run sync` pulls it but never pushes it.
  `bun run bvr:backup` copies it with the other JSON.

Start New Season on a team with no team file and no data in the old files
creates the team file. A team that has old data but no team file keeps the old
behavior until `bvr:migrate` runs, so its history is not hidden.

## Commands

```bash
bun run bvr:backup                          # copy the runtime JSON to ~/Backups/drafts-bvr/<stamp>/
bun run bvr:migrate --dry-run               # show what forward would write
bun run bvr:migrate                         # back up, then write teams/<id>.json
bun run bvr:migrate --verify                # is everything in the old files in the team files?
bun run bvr:migrate --reverse --out ~/tmp/bvr-reverse    # rebuild the old files for main
```

All of them take `DRAFTS_DEST=<scratch Drafts folder>` to work away from
iCloud. Output is counts and draft IDs only, never game contents.

### Forward

Reads `records.json`, `practicePlans.json`, and the committed `teams.yaml`,
and writes one team file per team in `teams.yaml`. It never changes the old
files, and it backs up the data folder before writing.

- Bare-array seasons from 2024 become ordinary entries with
  `seasonRecordDraftID: null`.
- `2026W7` in `practicePlans.json` becomes `W7` in season `2026-<season>`.
- The `teams.yaml` `startDate` goes on the season of the same year. Older
  seasons get null. The season `teams.yaml` describes is created even if it
  has no games yet.
- Once a team file has a current season, a re-run does not add the
  `teams.yaml` season beside it, so a season started under another name does
  not gain an empty sibling.
- `currentSeason` is the newest season that has started, counting a season
  without a start date from Jan 1 of its year. If every season is still ahead,
  it is the earliest upcoming one.
- Teams in the old files but not in `teams.yaml` are reported and skipped.

**Re-running is safe.** Existing team files are the starting point. Games are
matched by `draftID` and plans by week key. Anything the team file lacks is
added, and anything already in the team file wins, so a game recorded or
updated on the branch is never overwritten or dropped. An existing
`currentSeason` is kept. One consequence: an edit made on `main` to a game the
team file already has (marking it submitted, say) is not carried forward.
`--verify` lists such games under "different in team file".

### Verify

Rebuilds the old files from the team files alone and compares them with the
real ones, per team and year, pairing games key by key so a duplicate that
went missing is caught. A game counts as different only if its content
differs; key order is ignored. It lists draft IDs missing from or different in
the team files, practice-plan keys likewise, and counts games that exist only
in the team file. Exits 1 when anything differs.

### Reverse

Lays the team files over the current `records.json` and `practicePlans.json`
and writes the result to `--out`. Team-file games and plans win, and games
only the old files have are kept, as are teams and keys the team files do not
cover. Seasons come back in the object form even when they started as bare
arrays.

- Seasons are applied in start-date order. When two land in the same year
  (`2026-fall` and a `2026-winter` starting in November), their games merge
  and the later season's practice-plan weeks and season record draft win. A
  warning names both.
- A season whose ID has no leading year fails the run instead of being
  dropped.
- It refuses an `--out` that is a live data folder, comparing with symlinks
  resolved and case folded, against both the `DRAFTS_DEST` folder and the
  real iCloud one. To hand data back to
`main`, back up, then copy the two files from `--out` into
`<Drafts>/Library/Data/bvr/`.

## Editing a season

The Edit Season action (`Library/Actions/bvr/edit-season.js`) changes the
current season of a team-file team in one prompt, prefilled from the file:

- **Name** (`label`). A blank name keeps the old one. The season ID never
  changes.
- **First Day** (`startDate`). If the season has practice plans, a yes/no
  prompt warns first: weeks are counted from this date, and plans already
  made keep their `W<n>` keys.
- **Last Day** (`endDate`). A Drafts date picker cannot be left empty, so a
  "Has a last day" switch decides: off saves `null`, on saves the picked
  date.
- **One link per form** the team submits, showing the link in effect. A link
  that comes from the term is labeled "(shared for 2026 Fall)". A change is
  saved where the link came from: the season's override if it has one, else
  the term's shared entry (so every team in the term gets it), else the
  season. A field left blank clears the link from both places, only after a
  yes/no prompt; on no, blanks are ignored. Text that is not a link leaves
  the saved link and says so.

- **Attendance messages to / Score messages to**, as comma-separated
  initials. A list with no season override is labeled "(team default)".
  Unknown initials are named and the prompt asked again with what was typed,
  up to three times. A list that matches the default clears the override.
- **Roster draft**, shown by title, with a "Start a new roster draft" switch
  that makes one as Start New Season does and opens it.

It saves once, through the store's validation, and the success message lists
what changed. A team still on `records.json` is told to run `bvr:migrate`
first.

## The build and team files

Team files are written in iCloud, by Drafts and by `bvr:migrate`. `data`
pulls them into the repo so the repo-side tools can read them, but push never
sends them back: `Library/Data/bvr/teams/` is excluded, which also keeps
`--delete` away from it. A stale local copy can therefore never overwrite a
newer one. Watch rebuilds now pull before they push, as `sync` does.
