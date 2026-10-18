# BVR Team File

Status: introduced 2026-10-18 on `feature/season-architecture`, step 2 of
[the season architecture plan](../explanation/season-architecture-plan.md).

Each BVR team has one runtime file holding all of its seasons. It replaces
`records.json` and `practicePlans.json` for teams that have one. Drafts writes
it, it lives in iCloud beside the old files, and it is never in git.

```
<Drafts>/Library/Data/bvr/teams/<teamID>.json
```

The folder name comes from `teamFilesDir` in `Library/Data/bvr/settings.tpl`.
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
      "formURL": null,
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
| `formURL` | string or null | Not read yet. This season's score-report form, a later phase |
| `recipients` | string[] or null | Not read yet. Initials of who gets notified, a later phase |
| `attendanceDraftID` | string or null | Not read yet. `teams.yaml` still supplies it |
| `seasonRecordDraftID` | string or null | The season record draft. Copied verbatim from `records.json`, so an old `""` stays `""` |
| `games` | Game[] | Exactly what `Game.toJSON()` writes, unchanged from `records.json` |
| `practicePlans` | object | Week key (`W7`) to practice plan draft ID |

## Season IDs

A season ID is an explicit string, decoupled from the calendar year.

- Migrated seasons are `<year>-<season>`, with `season` from `teams.yaml`
  (`2026-fall`, `2025-spring`). A team without `season` gets the bare year.
- Start New Season accepts any string, so a winter sport can use `2026-winter`
  or `2026-27`.
- The label is derived from the ID: `2026-fall` reads `2026 Fall`. Any other
  shape is its own label.
- The old code keys seasons by calendar year. A reverse run files each season
  under the year its ID starts with, so `2026-27` lands under `2026`.

## How the Drafts scripts choose storage

`Season` picks the storage once per run, and `PracticePlan` and `Game` go
through it.

- **Team file exists:** read and write it. The `current_season` template tag
  is the season ID (`2026-fall`) and `current_season_label` is the label.
- **No team file:** behave as before against `records.json` and
  `practicePlans.json`, and show one info message saying the team has not been
  migrated. `current_season` is the year and so is `current_season_label`.

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
real ones, per team and year. It lists draft IDs missing from or different in
the team files, practice-plan keys likewise, and counts games that exist only
in the team file. Exits 1 when anything differs.

### Reverse

Lays the team files over the current `records.json` and `practicePlans.json`
and writes the result to `--out`. Team-file games and plans win, and games
only the old files have are kept, as are teams and keys the team files do not
cover. Seasons come back in the object form even when they started as bare
arrays. It refuses to write into the live data folder. To hand data back to
`main`, back up, then copy the two files from `--out` into
`<Drafts>/Library/Data/bvr/`.

## The build and team files

`bun run sync` pulls every runtime `.json`, team files included, before it
pushes. The push step also protects `Library/Data/bvr/teams/` from
`rsync --delete`, so a team file Drafts wrote before the next pull survives.
