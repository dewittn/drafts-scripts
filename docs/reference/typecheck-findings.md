# Type Check Findings

Status: Baseline recorded 2026-10-16, Phase 1 of the TypeScript migration
Checker: `bun run typecheck` (`scripts/typecheck.ts`), TypeScript 5.9.3, `strict: false`

This is what the first type check of the existing JavaScript found. No source file was
changed to make the check pass. Every remaining error is recorded in
`scripts/typecheck-baseline.json` and explained below, grouped by what it most likely
means. The check fails only on errors that are not in the baseline.

## Error counts

| Stage | Errors |
|-------|--------|
| Plain `tsc --noEmit` with the official definitions | 884 |
| Checker models Drafts' `require()` and per-run scope, `console` declared | 386 |
| Definition fixes in `types/` (see "Fixed in the definitions") | 348 |

The 348 remaining errors are 299 baseline entries. Zero `// @ts-ignore` comments were
added.

| Group | Errors | Meaning |
|-------|--------|---------|
| Real-bug candidates | 36 | Likely wrong at runtime when the line runs |
| Ambiguous, verify in Drafts | 6 | Depends on runtime behavior the definitions do not capture |
| Checker limitations in source | 77 | Valid JavaScript TypeScript cannot follow |
| JSDoc does not match the code | 15 | Comments are wrong, runtime is fine |
| Test-only | 214 | Test patterns TypeScript cannot follow, plus one real test gap |

Line numbers below are as of commit `94e0a92` plus this branch.

## Why the baseline instead of `@ts-ignore`

The migration plan allowed a few `@ts-ignore` comments for real-bug candidates. A
green run that way would need comment edits on more than 50 files under `Library/`,
most of them production scripts synced to Drafts, against Phase 1's "no source changes"
rule. The baseline keeps every source file untouched. It still fails the moment new
code introduces an error, and each entry stops matching as soon as its line is edited.

To work through an item: fix the code, run `bun run typecheck`, then run
`bun run typecheck --update-baseline` and delete the row here.

## Real-bug candidates

These look wrong whatever the runtime does. None was verified in Drafts. Most sit on
code paths that may be rare or dead.

| Location | Error | Interpretation |
|----------|-------|----------------|
| `Library/Scripts/shared/libraries/airtable-v2.js:207` | Cannot find name `value` | `view(vaule)` misspells its parameter. Calling `.view()` throws a ReferenceError. |
| `Library/Scripts/shared/libraries/airtable-v2.js:48` | `defaultBaseID` does not exist | Reads `this.defaultBaseID`, but the field is private `#defaultBaseID`. Looking up base `"default"` returns undefined. |
| `Library/Scripts/shared/libraries/nocodb.js:138,142,201` | Duplicate identifier `offset` | `NocoTable` defines an `offset` getter and setter and an `offset(value)` method. The later method replaces the accessor, so `table.offset` returns a function. |
| `Library/Scripts/modules/bvr/core/Game.js:367` | `descrition` does not exist | Both key and property are misspelled. The `descrition` field is always undefined. The getter is `description`. |
| `Library/Scripts/modules/bvr/core/Game.js:412` | `seasonRecord` does not exist | No `seasonRecord` is defined anywhere. `#lookupDraftID()` throws a TypeError if reached. Probably meant `currentSeasonRecord`. |
| `Library/Scripts/modules/bvr/core/Season.js:86` | Comparison with `"array"` has no overlap | `typeof` never returns `"array"`, so `migrateCurrentSeason()` never runs from here. `Array.isArray` was probably meant. |
| `Library/Scripts/modules/bvr/messages/system_message.js:16` | `attendaceDraft` does not exist | `SystemMessage` never sets `attendaceDraft`. `subjectLine` throws unless a subclass sets it. |
| `Library/Scripts/modules/cp/core/Destinations.js:26` | Getter must return a value | `get entries()` computes `Object.entries(...)` without `return`. Always undefined. |
| `Library/Scripts/modules/cp/databases/AirTableDB.js:22` | Getter must return a value | `get debug()` has no `return`. Always undefined. |
| `Library/Scripts/modules/cp/documents/UlyssesDocument.js:278` | `ui` does not exist | Uses `this.ui`, but the class stores `#ui`. The Ulysses error path throws a TypeError instead of showing the message. |
| `Library/Scripts/shared/libraries/ulysses-v2.js:318` | Expected 0-2 arguments, got 3 | `open()` passes `false` as a third argument that `#openURL` ignores. Probably meant for `#openCallback`, which may wait for a callback. |
| `Library/Actions/cp/update-status-with-ulysses-id-v3.js:3` | `updateStatusOfRecord` does not exist | `ContentPipeline` has `updateStatusOfDoc`. This action throws as written. |
| `Library/Actions/nr/meat-inventory.js:6` | `active` does not exist on `Draft` | Should be `activate()`. This action throws as written. |
| `Library/Actions/nr/kutt-test.js:4,17` | Cannot find `KuttItAPI`, `script` | The class and the global it uses are not defined. Looks like an abandoned test action. |
| `Library/Actions/nr/morning-pages.js:35,41` | Cannot assign to `action` | Assigns to the Drafts global `action` without declaring a local. Works, but overwrites the current action object for the rest of the run. |
| `Library/Scripts/shared/libraries/ulysses.js` (14 errors) | Undeclared names, `"cancel"` status | Implicit globals (`targetId`, `callbackAction`, `baseURL`), a status check against `"cancel"` where Drafts reports `"cancelled"`, and JSDoc typing `keywords` as a string. No file requires `ulysses.js`, so this is dead code next to `ulysses-v2.js`. |

`Library/Actions/cp/get-url.js:9` assigns an undeclared `nextAction`, creating an
implicit global. That works in sloppy mode and is listed only for completeness.

## Ambiguous, verify in Drafts

These depend on runtime behavior the definitions do not capture. Each can be checked with
the "Eval Draft" action.

| Location | Error | Question |
|----------|-------|----------|
| `Library/Scripts/modules/bvr/core/Team.js:254`, `Library/Scripts/modules/nr/QueryLetter.js:43` | `Draft.query` expects 5-7 arguments, got 3 | Upstream marks `omitTags` and `sort` required. `QueryLetter` is recent, tested code, which suggests Drafts accepts the short form. If so, loosen the definition in `types/drafts-extensions.d.ts`. |
| `Library/Scripts/modules/bvr/core/Game.js:539` | `Shortcut.create` expects 2 arguments, got 1 | Same question for the `text` argument. |
| `Library/Scripts/modules/cp/templates/AuthorUpdate.js:82,85` | `format` does not exist on `Date` | Not declared anywhere. Drafts may bundle a date library that adds it. The upstream docs use `(3).days().fromNow()`, which is Date.js syntax. If it exists, declare it. If not, this template throws. |
| `Library/Scripts/modules/bvr/core/Game.js:568` | `templateTags` does not exist on `TmplSettings` | `TmplSettings` builds its fields dynamically, so this is likely fine. |

## Checker limitations in source

Valid JavaScript that TypeScript cannot follow without annotations. These need types or
JSDoc in Phases 4 and 5. Do not "fix" them now.

| Pattern | Errors | Detail |
|---------|--------|--------|
| `this.constructor.X` | 31 | TypeScript types `this.constructor` as `Function`, so static fields read through it are unknown (TypeScript issue #3841). One instance hides a real gap. `Settings.basePath` at `Library/Scripts/modules/cp/filesystems/CloudFS.js:127` reads a static that `Settings` does not define, so it is always undefined. Nothing reads it today. |
| `Settings` fields | 11 | `Settings` copies keys from JSON with `Object.assign(this, ...)`. The fields exist only at runtime. A typed settings interface fixes this in Phase 4. |
| `airtable-v2.js` responses | 16 | JSDoc types the response as `boolean \| {success, data}`, so `.success` is not provable. Ambiguous data shape. Settle it when typing airtable-v2. |
| Setters that return a value | 5 | `BearDocument.js:66`, `DraftsDocument.js:63`, `TestDocument.js:24,40`, `UlyssesDocument.js:67`. The return value is discarded. Harmless. |
| Date arithmetic | 4 | `new Date() - draft.createdAt` in `record-attendance.js:2` and `record-attendance-dry-run.js:5`. Valid JavaScript that TypeScript rejects. Separately, `oneSecond = 10000` is ten seconds. |
| `const draft` in actions | 4 | `beyond-the-book.js:4` and `author-update.js:3` declare their own `draft`, shadowing the Drafts global. That works at runtime. The checker then types it as the global `Draft`. |
| `Draft.prototype.isMorningPage` | 2 | `morning-pages.js` extends `Draft` locally. TypeScript ignores prototype assignments on declared classes. |
| `replace()` with non-string arguments | 2 | `Team.js:317` passes a number and `Attendance.js:234` passes a match result. JavaScript coerces both. |
| Other inference | 2 | `DocumentFactory.js:49` compares a document with `false`. `DraftsDocument.js:260` reads `.draft` after an undefined guard TypeScript cannot see. |

## JSDoc does not match the code

15 errors where a `@returns` or `@param` comment disagrees with what the code does. The
code is the source of truth. The comments should be corrected in Phase 4.

- **Menu managers return action objects, not booleans.** `StatusManager.js` (lines 58, 64,
  74, 79, 92, 100), `NavigationManager.js:43,50,51`, `MenuOrchestrator.js:90`,
  `DocumentManager.js:75`, and `PipelineManager.js:46,77` return `{ action: ... }`
  objects or `context.cancel()`. Their JSDoc says `boolean` or `string`.
- **`AirTableDB.js:27`** assigns to a field whose JSDoc type does not match.
- **`PushoverAlert.js:39`** passes `{}` where JSDoc expects a string map.

The two `keywords` errors in `ulysses.js` are the same kind of mismatch. They are counted
with that file's row under real-bug candidates.

## Test-only

| Pattern | Errors | Detail |
|---------|--------|--------|
| Assigned inside a callback | 190 | `let x; test.assertDoesNotThrow(() => { x = ... })`. TypeScript does not see assignments inside callbacks, so `x` stays `undefined` or `never`. This happens even with `strictNullChecks` off. |
| Stubbing Drafts globals | 9 | Tests reassign `Draft`, `HTTP`, `Credential`, `Template`, and `draft` to install stubs. That is valid at runtime but not for declared classes and constants. |
| **`MockUI` lacks `displayMenu`** | 2 | `Library/Tests/unit/shared/mockui-test.js:234` and the `defaultMenuSelection` setter. **This is a real gap.** It is why `mockui-test.js` fails under `bun run test` on `dev` today. |
| Other | 13 | `fastmail-test.js` omits fields the `createDraft` JSDoc marks as required (5). `settings-test.js` reads dynamic `Settings` fields (3). `servicecontainer-test.js` adds an undeclared `dependency` field (2). `mocks.js:401` passes a number to `parseInt`. `pipeline-workflow-test.js:260` compares `false === true`. `text-utilities-test.js` reads a variable before assignment. |

## Fixed in the definitions

These were definition problems, fixed in `types/` and not baselined. See
`types/README.md`.

- **CommonJS detection.** TypeScript treats any `.js` file that calls `require("x")` as
  a module, which hid every class from every other file. The checker rewrites
  `require(` to `Require(` in memory, so files stay scripts. No compiler option does
  this (`moduleDetection` and `module: none` / `preserve` were tried).
- **Per-run scope.** Each action and test is checked with only the files it requires,
  because Drafts gives every run a fresh context. That removed about 170 false
  "Cannot redeclare" errors.
- **`Airtable` clash.** Removed the official declaration by patch.
- **Tuple types.** `lines: [string]` and similar rewritten to arrays by patch.
- **`console`**, optional `cancel()` and `fail()` messages, `readJSON()` returning
  `any`, the `vendor/nr.js` `Draft` methods, and static `MustacheTemplate` factories.

## Incidental

Noticed while reading code. These are outside the checked files.

- `Library/Scripts/vendor/nr.js:36` sets `this.isAchived`, a misspelling of
  `isArchived`. `draft.archive()` from `nr.js` therefore does not archive. The vendor
  folder is excluded from checking.
