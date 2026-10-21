# Conventions refactor plan

Repo: /Users/dewittn/Programing/dewittn/Other/drafts-scripts
Branch: `feature/conventions-refactor` (off `dev`). Already checked out. Do not switch branches.

## Status

One commit per stage on the branch, each reviewed before the next starts. The branch is synced to Drafts after stage 4 and held there for a few days of real use (Record Attendance, Submit Game Report, Edit Game, Edit Season). Bug fixes go on the branch. Then it merges into `dev` with a PR.

| Stage | Items | State |
|---|---|---|
| 0. Safety net | tests for touched-but-uncovered paths; tests read the real `ui.yaml`; Drafts load check | done (load check not yet run in Drafts) |
| 1. Use what exists | 1–3, 5–9 | done |
| 2. Send to Fastmail | 4, 20 | done |
| 3. Shared helpers | 10–12, 15, 17 | done |
| 4. Season and Game split | 13, 14, 16, 18, 19, 21, GameEditor | not started |

While the branch is synced, the fallback is `dev` (`git switch dev && bun run sync`), not `main`: main predates the season rebuild and can't read team files.

## What this refactor is

An audit compared the Drafts runtime code written since 2026-10-11 (commit ceef60e onward) with the code before it (`ceef60e^`) and with the style guide at `~/Programing/dewittn/agentic-docs/coding/style-guide.md`. The items below are the verified findings. The goal is to bring the new code in line with the established conventions. **Behavior must stay the same**, with one exception: keep a behavior change when it fixes a real defect (the audit names these, e.g. item 1). The user's words: "keep improvements where they genuinely add value... but I'd still like the conventions to be roughly the same."

The user will test this branch in real use over the next few days (Record Attendance, Submit Game Report, Edit Game, Edit Season), so anything you break shows up at school. Be conservative.

## Rules for every stage

- Read first: `.claude/skills/drafts-change-workflow/SKILL.md`, `docs/reference/drafts-runtime.md`, the repo `CLAUDE.md`, and the style guide above.
- **Never read the rendered settings files** or the generated JSON under `Library/Data/` (settings.yaml, attendanceSettings.yaml, gameReportSettings.yaml, templateSettings.yaml, staff.yaml, and their .json outputs), or the iCloud Drafts folder. They hold PII. Read the `.yaml.tpl` sources. Plain committed YAML with no `.tpl` (teams.yaml, sports.yaml, ui.yaml, levels/*.yaml, forms.yaml, nr-settings.yaml if it has no .tpl — check) is fine.
- Require paths are always relative to `Library/Scripts/`. Use the guard style `if (typeof X == "undefined") require("path/X.js");` and require every class a file uses in that file (don't rely on another file having loaded it).
- Match surrounding code: guard clauses, single-line ifs for simple statements, `#private` fields, lazy getters, `==` (use `===` only where null and undefined must differ, as the code already does), section markers (`// ****` blocks) in long classes, 1–2 line comments that say what and why. Don't add JSDoc blocks or long comment paragraphs.
- Keep existing public method names and call signatures that actions and tests use. Actions in `Library/Actions/` must keep working unchanged unless the stage says otherwise.
- Don't touch `airtable-v2.js` (legacy).
- New Drafts actions can't be created from code. Don't add any.
- Checks that must pass before you finish: `bun run test` (all pass; "needs Drafts" for the two CP files is expected) and `bun run typecheck` (no new errors; don't add to the baseline).
- **Do not commit, push, sync, or run `bun run sync`/`watch`.** The reviewer does that. Run git as `git -C <repo> ...`; never `cd` inside a Bash call.
- Final message: a list of every file changed with one line each on what changed, any behavior change and why, anything from your stage you skipped or did differently and why, and the test/typecheck results.

## Findings (numbered as in the audit)

### A. Use what already exists

1. `Game.#readReportComments` (Game.js ~613) uses the old splice-based `#extractSectionText` / `#getSectionStartEnd` (Game.js ~764-783). That helper depends on Comments coming after Highlights, mutates the array, assumes one line after the heading, and on a missing heading removes the last line. Replace with `MarkdownSections.body(lines, heading)` (MarkdownSections.js:18) joined and trimmed; delete the two old helpers. Keep the result the same for a normal report (check `Library/Templates/bvr/game-report.md` for the exact headings, e.g. `## Highlights?` may be the literal heading). A missing heading should give "" (empty), as before for that field.
2. `SeasonRecordTable.withTally` (SeasonRecordTable.js:25) finds the title line itself; use `MarkdownSections.titleIndex` (and `replaceTitle` if it reads cleaner).
3. `QueryLetter.#choiceTags` (QueryLetter.js ~130) lowercases and hyphenates by hand; use `TextUtilities.convertTitleToSlug()` (modules/cp/utils/TextUtilities.js:16, call site cp/documents/DraftsDocument.js:107). Confirm the output is unchanged for the choices in nr settings (e.g. "Query Manager" -> "query-manager") and that query-letter-test still passes. Leave the `_` template-tag variant at ~115 as is (it's a different format), but it may move into a small named private method `#templateTagsFrom(fieldValues)` if that reads better.
4. (Stage 2) Send to Fastmail's missing-fields prompt is hand-built with `Prompt.create()` and inline strings (Actions/nr/send-to-fastmail.js:45-77); it also calls `app.display*` directly and shows the invalid-address error twice (`app.displayErrorMessage` then `context.fail`, which already shows one).
5. Roster draft creation `Season.#createAttendanceDraft` (Season.js ~694) builds draftTags/templateTags by hand, hard-codes the `"bvr/attendance.md"` fallback that `TeamConfig.defaultTemplates.attendance` (TeamConfig.js:11) already supplies, and adds a `season_label` tag duplicating `current_season_label` from TmplSettings. `Team.updateRoster` (Team.js ~362) hard-codes `# Attendance: ${abbr} ${label}`, a second copy of the title in `Library/Templates/bvr/attendance.md`. Fix: keep one source for the roster title. Careful: the roster draft is created during Start New Season, for the NEW season's label, possibly before/after `setCurrentSeason`; `TmplSettings`' `current_season_label` comes from `gblTmplSettings`, which may be cached on Team and still hold the old season. Only switch to TmplSettings if the label is provably the new season's; otherwise keep passing the label explicitly but drop the hard-coded fallback and keep a single title definition (e.g. a static `Team.rosterTitle(abbr, label)` used by updateRoster, while the template keeps its tag; or render the title from the template). Existing roster drafts in use have titles `# Attendance: <ABBR> <label>`; Update Roster must still match them.
6. `Team.createEndOfSeasonTasks` (Team.js ~302) repeats the tail of `createGameDayTasks` (template + `Action.find("Things Parser")` + `app.queueAction`). Extract one private `#queueThingsProject(tmplSettings)`. Also `createEndOfSeasonTasks` uses `TmplSettings` without a require guard; add it.
7. Small re-implementations:
   - `entry.label || this.currentSeasonID` style fallbacks in Season.js (~259, 269, 304) where `this.currentSeasonLabel` (store.label) already does it for the current season. Only replace where it is the current season's entry.
   - Season.js ~745 inlines `this.team.form(formName).title || formName`; use `#formTitle`. Game.js ~561 `gform.title || gform.name` — align only if a clean shared helper exists; otherwise leave.
   - `Staff.contacts` (Staff.js ~43) re-implements `Staff.unknown`; call `this.unknown(initialsList)`.
   - `GoogleForm.baseURL` (services/GoogleForm.js ~18) spells out `viewform|formResponse` which are the class's `static viewPath` / `submitPath`; build the pattern from them.
8. Config in code:
   - `Season.#askKeepRoster` (Season.js ~685) overwrites `ui.yaml`'s `attendanceDraftPrompt.menuMessage` with a hard-coded sentence, so the YAML text is dead. Make the YAML the source (e.g. a `[[title]]`-free approach: append the specifics to the YAML message like `#promptForFormURL` does at ~746, or put a placeholder in YAML and replace it). Keep the shown wording equivalent.
   - `TmplSettings` hard-codes `level_ms` / `level_us` (TmplSettings.js ~11-12). Build `[`level_${teamLevel}`]: true` so a new level needs no code change. Templates using `{{#level_us}}` / `{{#level_ms}}` must keep working; a falsy tag for the other level should behave the same in Mustache (missing == false).
   - `TeamConfig` defaults `attendanceOffice = "ATT"` (TeamConfig.js ~29), duplicating settings.yaml.tpl. Check how BVR passes it; if it is always passed, drop the literal default. Also unify the mixed default styles on that destructure (~29-34) if it reads cleaner.
   - Season.js uses both "Nothing was changed." and "Nothing changed." for the same situation (~252, ~264); pick one per meaning (no-op vs declined) consistently.
9. `DependencyProvider.ulysses` (cp/core/DependencyProvider.js ~64) is the one getter reaching into `ServiceContainer.getInstance()`; every other getter returns `this.#context.<x>`. Add a lazy `get ulysses()` to ContentPipeline (like `get text()`), return `this.#context.ulysses`, and drop DependencyProvider's ServiceContainer require if nothing else needs it. Check `UlyssesDocument.js:25` (the consumer) and that ContentPipeline registers `ulysses`.

### B. Keep, but write once

10. "Use the global `draft` when it is the target" is written in Attendance.js (~132 `loadDraft`), Game.js (~651, editGame), and Season.js (~886 `#findRecordsDraft`); `Season.#appendToRecordsDraft` (~837) uses bare `Draft.find`. One helper, e.g. `findDraft(uuid)` in `vendor/nr.js` (global functions live there) or on BVR next to `pinDraft`. Use it in all places. `#appendToRecordsDraft` switching to it is a (safe) behavior change: note it.
11. The "skip `applyWorkspace` when that workspace is already showing" guard is pasted in cp/core/ContentPipeline.js (~481-489), cp/documents/DraftsDocument.js (~215-220), cp/templates/Template.js (~83-86), bvr/core/BVR.js (~247-253). `Draft.prototype.activate` in vendor/nr.js (~20-26) and Actions/nr/morning-pages.js (~8-9) call it unguarded. One helper (e.g. `loadWorkspace(name)` in vendor/nr.js) used in all six. Watch the DraftsDocument note: `applyWorkspace(undefined)` resets to Default — preserve each call site's current handling of a missing/undefined workspace exactly.
12. `JSON.parse(JSON.stringify(this.ui.settings(...)))` is repeated in Season.js (~295, 609, 682, 743, 784) and Game.js (~638). Add a copy-returning method to `DraftsUI` (shared/libraries/DraftsUI.js, next to `settings(fnName)`), e.g. `settingsCopy(fnName)`, and use it. MockUI in Library/Tests/fixtures/mocks.js and any test UI stubs must get the same method. (`structuredClone` is not reliable in Drafts' JavaScriptCore; keep the JSON copy.)
13. (Stage 4) The "ask up to three times" loop is written three times in Season.js (~274 `#askSeasonEdits`, ~606 `#promptForRecipients`, ~765 `#promptForNewSeason`); the recipient fields are defined twice in ui.yaml (`editSeason` and `recipientsPrompt`, ~168-183 and ~210-225) — YAML anchors can dedupe if the yaml2json step supports them (check scripts/build.ts / the YAML lib).
14. (Stage 4) "Save the link to the term if there is one, else to the season" is written three times (Season.js ~183-188, ~403-413, ~719-725).
15. Date helpers: `Season.#parseYMD` (~487) and the same parse in PracticePlan.js (~189); `Season.#comingMonday` (~807) and `PracticePlan.isoMonday` (~197). Put `parseDateYMD` (and a Monday helper if the two really compute the same thing — check; "coming Monday" and "ISO Monday of a week" differ) in `modules/bvr/utils/BVRUtilities.js` next to `formatDateYMD`, and use them. `PracticePlan.weekNumber`/`isoMonday` are tested statics; keep their public names working.
16. (Stage 4) `TeamFileStore` and `FormLinkStore` each write the same file handling: an `isObject` check (TeamFileStore.js:33, FormLinkStore.js:35, TeamConfig.js:42), load-check-throw (TeamFileStore ~19-27, FormLinkStore ~18-31), create-empty with `ensureDirectoryFor` + `Object.assign` (TeamFileStore ~49-59, FormLinkStore ~20-24), validate-before-save (TeamFileStore ~187-191, FormLinkStore ~65-69). Move the shared mechanics onto `DataFile` in modules/cp/filesystems/CloudFS.js (~92-132) where the next search finds them. No base class (composition over inheritance). `FormLinkStore.load` creates the folder on read even when nothing is saved; move folder creation to save.
17. The `.yaml` deprecation warning is identical in cp/filesystems/CloudFS.js (~83-89) and vendor/nr.js (~218-223). Keep one implementation and have the other call it (vendor/nr.js `loadSettings` is global; CloudFS may call it, or both call a tiny shared function). Don't delete the safety net.

### C. Structure (stage 4)

18. Season.js is 922 lines with four unrelated groups and no section markers. Split following the existing delegation pattern (`Team.editGame()` constructs `new Game(this.dependencies)` and calls it):
    - `modules/bvr/core/Season.js` — store selection, current-season getters, `ensureCurrentSeason`, `ensureFormURL`, `updateWith`, `rebuildRecordWith`, `recordRow`, record draft append/rebuild, `startNewSeason()` and `editCurrentSeason()` kept as thin public entry points that delegate.
    - `modules/bvr/core/SeasonSetup.js` — Start New Season flow: season prompt, complete existing season, roster draft settle/keep/create, recipients prompt, missing-links prompts.
    - `modules/bvr/core/SeasonEditor.js` — Edit Season flow: prompt, `#seasonEdits`, `#applySeasonEdits`, confirmations.
    - `modules/bvr/utils/SeasonFormLinks.js` — effective link, lifting season links to the term, the single "save to term, else season" rule (item 14).
    - Pure recipient helpers (`#recipientOverrides`, `#typedRecipients`) go to `TeamConfig` as statics (next to `withSeasonRecipients`, TeamConfig.js ~55) so tests can reach them.
    - Item 13's retry loop becomes one helper used by all three.
19. Store boundary: Season edits label, startDate, endDate, recipients, attendanceDraftID, formURLs directly on raw entries from `store.season` / `seasonFor()` and calls `store.saveGames()` as a general save. The legacy `formURL === null` cleanup is in both TeamFileStore.js:144 and Season.js:427. Give the stores one `updateSeason(seasonID, fields)` (or equivalent) and a `save()`; keep `saveGames()` as an alias only if tests/other callers need it, otherwise rename callers. LegacySeasonStore must expose the same interface where Season calls it.
20. (Stage 2) Send to Fastmail isn't a thin action: validation, the signature question, the recursive re-prompt and success reporting all live in the 77-line action file. Move the flow into a `modules/nr/` class constructed like `QueryLetter` (`(settings, ui)`), with prompt settings in `Library/Data/nr-settings.yaml` (or the .tpl if that's the source — check which exists) built with `DraftsUI.buildMenu`. The action becomes thin like `Actions/nr/query-letter.js`. Then update the skill's "good model" line (`.claude/skills/drafts-change-workflow/SKILL.md`, "Thin actions" bullet) to name the new pair.
21. (Stage 4) Comments: trim the 4–8 line method comments in files this stage rewrites (Season and its new pieces, the Edit Game block) to 1–2 lines that say what and why. Keep comments that record a non-obvious Drafts gotcha or legacy data shape.

Also stage 4: Game.js is 783 lines; move the Edit Game block (Game.js ~625-763: `editGame`, `#askGameEdits`, `#recordedScoreRows`, `#describeGameEdits`, `#applyGameEdits`, `#rewriteReportDraft`, `#recordNotes`, `#editMessageType`, `#correctSubmission`) into `modules/bvr/core/GameEditor.js`, constructed with the game (and dependencies), with `Game.editGame()` kept as the entry point Team calls. Whatever private Game methods it needs (`#sendMessages`, `#submitGoogleForm`, `#readReportComments`, `#applyGameEdits`' setters) must become reachable without leaking more than needed.

## Leave alone

MarkdownSections, SeasonRecordTable (beyond item 2), TeamFileStore/LegacySeasonStore/FormLinkStore interfaces (beyond items 16/19), Staff (beyond item 7), TeamConfig layering, fastmail.js (except: its `createDraft` may get two small private extractions `#draftsMailboxId(session)` / `#buildEmail(...)` in stage 2 if it reads better), EmailDraft (stage 2 may align `this.constructor.parseRecipients` vs `EmailDraft.findInvalidAddresses` to one style), `ensureCurrentSeason`, the display-then-throw when a team file is unusable (it may become one private `#stopWith(message)` in stage 4).
