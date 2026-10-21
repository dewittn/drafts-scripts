# Type definitions

Type information for checking the Drafts scripts with `bun run typecheck`. Nothing
here is synced to Drafts or used at runtime.

| File | What it is |
|------|------------|
| `drafts.d.ts` | Official Drafts definitions, vendored and patched. Do not edit by hand. |
| `drafts-extensions.d.ts` | Project additions: globals and fixes the official file lacks. |
| `checker-shim.d.ts` | Names used only by `scripts/typecheck.ts` (see that file's header). |
| `test-runner.d.ts` | Globals `scripts/test-runner.js` gives unit tests (`loadRepoYAML`). |

## Vendored source

`drafts.d.ts` comes from
[agiletortoise/drafts-script-reference](https://github.com/agiletortoise/drafts-script-reference),
file `src/drafts.d.ts`, commit `c91a3cdf3500b2bd9c0d599882b4de09a03e1ae1`
(committed 2026-09-11, retrieved 2026-10-16). The first line of the file records the
same information.

## Patches

`scripts/update-drafts-types.ts` applies two patches. Both are idempotent.

1. **Remove `declare class Airtable`.** Drafts has a built-in `Airtable` class. This
   project defines its own global `class Airtable` in
   `Library/Scripts/shared/libraries/airtable-v2.js`, which shadows the built-in at
   runtime. Two global classes with one name are a type error, so the official
   declaration is replaced with a `PATCHED(drafts-scripts)` marker comment.
2. **Rewrite one-element tuples as arrays.** Upstream writes `lines: [string]` where
   it means `string[]`, so `draft.lines[3]` is reported as out of range. Only type
   positions are rewritten. Comments are left alone.

## Refreshing

```bash
bun scripts/update-drafts-types.ts   # download upstream main, re-apply patches
bun run typecheck                    # look for new or vanished errors
git diff types/drafts.d.ts           # review what upstream changed
```

The script fails loudly if it cannot find the `Airtable` declaration, which means
upstream changed shape and the patch needs a look.

After a refresh, check each block in `drafts-extensions.d.ts` against the new file.
If upstream fixed one of the problems it works around, delete that block.

## What `drafts-extensions.d.ts` covers

- `console`, which Drafts provides but the official file does not declare. The DOM
  lib that normally supplies it is left out on purpose.
- `Context.cancel()` and `Context.fail()` with no message. Upstream marks the message
  required while documenting it as optional.
- `FileManager.readJSON()` returning `any` instead of `object`.
- Methods `Library/Scripts/vendor/nr.js` adds to `Draft.prototype`.
- `MustacheTemplate.createWithTemplate()` and `createWithPath()` as statics. Upstream
  declares them as instance methods while documenting static use.

The file starts with a `/// <reference path="drafts.d.ts" />`. That makes the
official file load first, so the overloads declared here take priority.
