# TypeScript Migration Reference

Status: Research / Pre-planning
Date: 2026-03-06

## Codebase Inventory

| Category | Count | Notes |
|----------|-------|-------|
| Source files (non-vendor) | ~55 | `Library/Scripts/` |
| Action scripts (entry points) | ~41 | `Library/Actions/` |
| Test files | 12 | `Library/Tests/` |
| Vendor files | 6 | `Library/Scripts/vendor/` |
| Class definitions | ~70 | Modern JS: private `#fields`, `static`, inheritance |
| JSDoc annotations | ~144 | Across 12 files (mostly tests/mocks + ServiceContainer) |

## Runtime Constraints

Drafts uses a **custom JavaScriptCore runtime**, not Node.js.

- `require()` is Drafts-specific — loads files relative to `Library/Scripts/`, puts classes into global scope
- Classes become globals after require; `typeof X == "undefined"` guards prevent double-loading
- `module.exports` only in 5 files, guarded with `typeof module !== 'undefined'` for Node.js compat
- Drafts provides native bridge globals: `draft`, `app`, `editor`, `context`, `device`, `action`
- **Output must be plain `.js` files** synced to iCloud — Drafts loads them directly

## Existing Type Definitions

Official Drafts type definitions exist:
- **Source**: https://github.com/agiletortoise/drafts-script-reference/blob/main/src/drafts.d.ts
- **Size**: 6,463 lines
- **Coverage**: 74 classes, global objects, `require()` function
- **Includes**: `Action`, `App`, `Draft`, `Editor`, `Credential`, `FileManager`, `HTTP`, `Prompt`, `Airtable`, and ~65 more

### Conflict: Airtable class

The official `drafts.d.ts` declares `class Airtable` which conflicts with the custom `airtable-v2.js` wrapper in this project. Options:
1. Exclude the official `Airtable` declaration (patch or `/// <reference>` selective imports)
2. Rename the project's class (e.g., `DraftsTable`)
3. Use module namespacing once imports are proper

## Module System

Current pattern (every source file):
```javascript
if (typeof SomeClass == "undefined") require("path/to/SomeClass.js");

class MyClass {
  // ...
}
```

All paths are relative to `Library/Scripts/` regardless of file location. This is a Drafts convention, not Node.js resolution.

### Implications for TypeScript
- TS source would use proper `import`/`export` statements
- Build step must compile back to the global-scope pattern Drafts expects
- Or: use `outFile` concatenation per-module (less ideal)
- The bun bundler approach (see below) could handle this more elegantly

## Build Pipeline

### Current: Gulp
```
gulpfile.js (ES module syntax)
  1. copyJSONData    — rsync JSON from iCloud to local
  2. injectSecrets   — 1Password CLI processes .tpl -> .yaml
  3. convertYamlToJson — .yaml -> .json for runtime
  4. rsyncLibrary    — sync Library/ to iCloud Drafts directory
  5. watchFiles      — dev mode file watcher
```

Dependencies: `gulp@5`, `gulp-exec`, `gulp-ext-replace`, `gulp-rsync`, `gulp-util`, `js-yaml`, `fancy-log`

### Proposed: Bun

Bun is a strong candidate to replace Gulp because:
- **Native TypeScript support** — no separate `tsc` step needed
- **Built-in bundler** — can replace gulp-rsync file operations
- **Built-in test runner** — can replace the custom TestAssertions framework
- **Fast** — significantly faster than Node.js + Gulp for build tasks
- **Already partially present** — `@types/bun` is in devDependencies, `typescript@^5` is a peerDependency

Key build tasks to replicate in Bun:
- File sync to iCloud directory (replace `gulp-rsync`)
- 1Password secret injection (`op inject` — shell exec, framework-agnostic)
- YAML-to-JSON conversion (`js-yaml` works in Bun)
- File watching for dev mode (Bun has `Bun.file` watcher or use `chokidar`)
- **New**: TypeScript compilation / bundling

#### Gulp -> Bun Task Mapping

| Gulp task | Bun equivalent |
|-----------|---------------|
| `rsyncLibrary` (gulp-rsync) | `Bun.spawn(["rsync", ...])` or `Bun.file()` copy |
| `injectSecrets` (gulp-exec + op) | `Bun.spawn(["op", "inject", ...])` |
| `convertYamlToJson` (js-yaml) | `js-yaml` works natively in Bun |
| `watchFiles` (gulp.watch) | `fs.watch()` or `chokidar` (see watch mode note) |
| `copyJSONData` (rsync) | `Bun.spawn(["rsync", ...])` |
| **New: TS transpile** | `bun build --no-bundle --outdir` |

#### Watch Mode Note

`Bun.build()` does not have a built-in `watch: true` option (tracked in oven-sh/bun#5866).
Options:
- Run `bun --watch build.ts` to re-run the build script on file changes
- Use `fs.watch()` or `chokidar` in a custom build script
- Not a blocker — watch logic is manual in current Gulp setup too

### Bundling Strategy (Research Complete)

Drafts loads individual `.js` files, so the bundler must emit **one output file per entry point**, not a single bundle.

#### Strategy A: Transpile-only (recommended starting point)

```bash
bun build ./src/**/*.ts --no-bundle --outdir ./Library/Scripts
```

- `--no-bundle` flag transpiles each `.ts` to a corresponding `.js` without combining files
- Strips type annotations, preserves everything else
- Output is nearly identical to current JS files
- Keeps existing `require()` + global-scope pattern unchanged
- **Available today, zero runtime risk**

For programmatic control, `Bun.Transpiler` API can also handle per-file transpilation:
```typescript
const transpiler = new Bun.Transpiler({ loader: 'ts' });
const js = await transpiler.transform(await Bun.file('./src/MyClass.ts').text());
```

#### Strategy B: Per-action bundle (future option)

Bundle each Action script with all its dependencies into a self-contained file.
- Eliminates `require()` chain entirely
- Requires IIFE output format with `globalNames` support
- **Not ready yet**: Bun's IIFE format exists (`--format=iife`) but `globalNames` is unimplemented (tracked in oven-sh/bun#9685, closed from #10872)
- Revisit when `globalNames` ships

#### Strategy C: Hybrid (future option)

Transpile library/module files individually, bundle action scripts.
- Best of both worlds but most complex build config
- Depends on Strategy B becoming viable

**Decision: Start with Strategy A.** Lowest risk, available now, and doesn't preclude moving to B or C later.

## Test Infrastructure

### Current State
- **Framework**: Custom `TestAssertions` class (hand-rolled, console-based)
- **Mocks**: `MockUI`, `MockDatabase`, `MockFileSystem`, `MockUlysses` — well-structured, track interactions
- **Coverage**: 12 test files for ~55 source files (~22% file coverage)
- **Run environment**: Tests run inside Drafts app via action scripts
- **No CI**: Tests are manual, no automated test runner

### With TypeScript + Bun
- Bun's built-in test runner could run tests outside Drafts (against compiled JS)
- Mocks would become interfaces — ensuring they stay in sync with real implementations
- The Drafts MCP server could enable integration tests that run in the actual Drafts runtime
- Could keep `TestAssertions` for in-Drafts smoke tests while using Bun for full test suite

## Benefits Assessment

### For Coding Agents (high impact)
- DI container (`ServiceContainer`, `DependencyProvider`) is currently untyped — agents must read multiple files to understand what `.ui`, `.db`, `.fs` expose
- Method signatures are implicit (e.g., `open(docID, docIDType)` — what values are valid for `docIDType`?)
- With interfaces, agents understand the full dependency graph from type definitions alone
- Reduces file reads per task significantly

### For Test Coverage (high impact)
- Interfaces for mocks enforce sync with real implementations
- `ServiceContainer` could be generically typed
- Strict null checks would catch the class of bug in commit `11fae82` (uninitialized `#tmplSettings`)
- Typed mocks with auto-complete make writing new tests faster

### For Code Quality (medium impact)
- Already uses modern JS well — private fields, static properties, class inheritance
- 144 JSDoc annotations show intent to document types; TS enforces them
- `record = {}` default params + nested property access is a common `undefined` source

## Migration Phases

These scripts run daily in production. The migration must never leave `main` broken.
Branch strategy: all work happens on `dev` or a `feature/typescript-migration` branch.
Only merge to `main` and re-sync to iCloud when validated.

**Total estimate: ~9-14 sessions, ~16-25 hours**

### Time Estimate Breakdown

| Phase | Sessions | Time/Session | Estimated Total |
|-------|----------|-------------|-----------------|
| 1. Foundation | 1 | ~1 hr | ~1 hr |
| 2. Bun build | 2-3 | ~2 hrs | ~4-6 hrs |
| 3. `src/` restructure | 1-2 | ~1.5 hrs | ~1.5-3 hrs |
| 4. Core types | 2-3 | ~2 hrs | ~4-6 hrs |
| 5. Remaining types | 2-3 | ~2 hrs | ~4-6 hrs |
| 6. Test infra | 1-2 | ~1.5 hrs | ~1.5-3 hrs |
| **Total** | **9-14** | | **~16-25 hrs** |

Notes on estimate:
- Phases 4-5 could compress significantly with agent-assisted typing (rename, annotate, diff, repeat)
- Phase 2 is the wildcard — build tooling edge cases always take longer than expected
- Estimate assumes paired sessions spread over a few weeks, using scripts normally between phases

### Actual Time Tracking

| Phase | Estimated | Actual | Notes |
|-------|-----------|--------|-------|
| 1. Foundation | ~1 hr | | |
| 2. Bun build | ~4-6 hrs | | |
| 3. `src/` restructure | ~1.5-3 hrs | | |
| 4. Core types | ~4-6 hrs | | |
| 5. Remaining types | ~4-6 hrs | | |
| 6. Test infra | ~1.5-3 hrs | | |
| **Total** | **~16-25 hrs** | | |

### Phase 1: Foundation (~1 session, zero risk)

No source changes, no build changes. Adds type checking to existing JS immediately.

- [ ] Download `drafts.d.ts` into project
- [ ] Create `tsconfig.json` with `allowJs: true`, `checkJs: true`
- [ ] Get immediate type checking on existing `.js` files
- [ ] Resolve `Airtable` class conflict (official d.ts declares `class Airtable`)
- [ ] Create `drafts-extensions.d.ts` for project-specific globals

**Gate**: Type checker runs without errors on existing JS. No runtime changes.

### Phase 2: Bun Build Script (~2-3 sessions, medium risk)

This is the riskiest phase. The build pipeline is what gets code to iCloud.

- [ ] Create Bun-based build script replicating all Gulp tasks
- [ ] Replicate: iCloud sync, secret injection, YAML->JSON, file watch
- [ ] **Run both Gulp and Bun in parallel** — diff their outputs
- [ ] Validate output is byte-for-byte identical to Gulp output
- [ ] Add TypeScript transpilation step (`bun build --no-bundle`)
- [ ] Only remove Gulp after the Bun pipeline has been validated for several days

**Gate**: `diff -rq` between Gulp output and Bun output shows no differences.
**Rollback**: Gulp remains on `main` until Bun pipeline is proven.

### Phase 3: `src/` Restructure + Initial Rename (~1-2 sessions, low risk)

Create the `src/` tree, rename `.js` -> `.ts`, verify transpiled output matches originals.

- [ ] Create `src/` directory mirroring `Library/` structure
- [ ] Move `.js` source files to `src/` as `.ts` (no type annotations yet — just rename)
- [ ] Configure Bun build to transpile `src/ -> Library/`
- [ ] Copy non-JS assets (Data, Templates, Themes, vendor) into `Library/`
- [ ] **Diff transpiled output against original committed JS** (see Validation Strategy)
- [ ] `.gitignore` generated files in `Library/Scripts/` and `Library/Actions/`

**Gate**: Diff shows transpiled JS is functionally identical to hand-written JS.
Can stop here and use scripts normally — they're still plain JS at runtime.

### Phase 4: Core Module Type Annotations (~2-3 sessions, low risk)

Add types to the dependency backbone. Transpiled output shouldn't change.

- [ ] Convert `shared/core/` (ServiceContainer, DependencyProvider, ServiceFactories)
- [ ] Define interfaces for all injectable services (UI, DB, FS, Ulysses)
- [ ] Convert `modules/cp/core/` (ContentPipeline, Statuses, Destinations, RecentRecords)
- [ ] Convert `modules/cp/managers/` (BaseManager + 5 subclasses)
- [ ] Re-diff after each module to confirm output is unchanged

**Gate**: Diff still clean. Type checker catches real issues (e.g., nullable access).
This is where agent-assisted development starts to improve noticeably.

### Phase 5: Remaining Modules + Libraries (~2-3 sessions, low risk)

Incremental. Can stop at any point — each module is independent.

- [ ] Convert `shared/libraries/` (airtable-v2, ulysses-v2, bear, DraftsUI, etc.)
- [ ] Convert `modules/cp/documents/` (DocumentFactory + document types)
- [ ] Convert `modules/cp/templates/`, `databases/`, `filesystems/`
- [ ] Convert `modules/bvr/` module
- [ ] Convert `Library/Actions/` entry points (thin wrappers, lowest priority)

**Gate**: Full diff clean. Can merge to `main` after each sub-module.

### Phase 6: Test Infrastructure (~1-2 sessions, zero risk)

Purely additive — doesn't touch production scripts.

- [ ] Add interfaces for mock classes (MockUI, MockDatabase, MockFileSystem, MockUlysses)
- [ ] Set up Bun test runner for outside-Drafts testing
- [ ] Convert test files to TypeScript
- [ ] Keep `TestAssertions` as Drafts-side smoke test runner
- [ ] Integrate Drafts MCP server for runtime validation

**Gate**: Tests pass in both Bun and Drafts.

### Risk Summary

| Phase | Risk | Why | Rollback |
|-------|------|-----|----------|
| 1. Foundation | None | No runtime changes | Delete tsconfig |
| 2. Bun build | **Medium** | Changes how files reach iCloud | Gulp on `main` |
| 3. `src/` restructure | Low | Diff validates output | `git revert` |
| 4. Core types | Low | Types are stripped at compile | `git revert` |
| 5. Remaining types | Low | Incremental, per-module | `git revert` |
| 6. Test infra | None | Additive, no production impact | Delete test config |

The key insight: **Phases 3-5 are mechanically safe because `--no-bundle` just strips types.** If the diff is clean, runtime behavior is identical. Phase 2 deserves the most caution because it changes the deployment mechanism.

## Files by Priority

High (convert first — most dependency surface):
- `shared/core/ServiceContainer.js`
- `shared/core/ServiceInitializer.js`
- `shared/core/ServiceFactories.js`
- `modules/cp/core/DependencyProvider.js`
- `modules/cp/core/ContentPipeline.js`
- `modules/cp/managers/BaseManager.js`

Medium (significant logic, benefit from types):
- `shared/libraries/airtable-v2.js` (4 classes, API wrapper)
- `shared/libraries/ulysses-v2.js` (2 classes)
- `shared/libraries/DraftsUI.js`
- `shared/libraries/nocodb.js` (4 classes)
- `modules/cp/documents/*.js` (5 files, polymorphic)
- `modules/cp/managers/*.js` (5 files, inheritance)

Low (simple or standalone):
- `modules/bvr/` (sports module, less complex DI)
- `Library/Actions/` (thin entry points)
- `shared/libraries/bear.js`, `kutt.js`, `PushoverAlert.js`

Skip:
- `Library/Scripts/vendor/` (third-party, leave as `.js`)

## Resolved Questions

1. **Bun bundler output format**: YES — `bun build --no-bundle` transpiles individual `.ts` files to `.js` without bundling. Output preserves the existing global-scope pattern. No custom transform needed.
2. **IIFE / globalNames**: NOT NEEDED for Strategy A. IIFE exists in Bun but `globalNames` is unimplemented. Only needed if we pursue per-action bundling (Strategy B) in the future.

## Open Questions

1. **Drafts `require()` in TypeScript**: How to represent the `typeof X == "undefined"` guard pattern in TS source? Options:
   - Use standard `import` and have the build emit `require()` calls (needs custom transform or plugin)
   - Keep `require()` in TS source with `declare function require()` from `drafts.d.ts` (simplest, no build transform needed)
   - The `--no-bundle` flag preserves `require()` calls as-is, so option 2 works today
2. **Test runner dual-mode**: Can tests share code between Bun runner (CI/dev) and Drafts runner (integration)? The Drafts MCP server may bridge this.
3. **Airtable conflict resolution**: Which approach — rename, exclude from d.ts, or namespace?
4. **iCloud sync timing**: Does adding a transpile step introduce noticeable latency in the watch/dev workflow? Bun is fast, but worth measuring.
5. **Source directory layout**: Leaning toward Option B (separate `src/` tree). See "Source Directory Layout" section below.

## Source Directory Layout

### Option A: In-place

`.ts` files live in `Library/Scripts/`, transpile to `.js` alongside them.

```
Library/
  Scripts/
    shared/core/ServiceContainer.ts   (source)
    shared/core/ServiceContainer.js   (transpiled output)
  Actions/
    cp/add-draft-to-pipeline.ts
    cp/add-draft-to-pipeline.js
```

- Simplest migration: just rename `.js` -> `.ts` in place
- Add `--exclude='*.ts'` to rsync so Drafts never sees TypeScript files
- Muddies source vs output — git tracks both, easy to accidentally edit `.js`
- `.gitignore` would need to ignore `*.js` in `Library/Scripts/` but not vendor files

### Option B: Separate `src/` tree (preferred)

`.ts` source lives in `src/`, Bun transpiles into `Library/`, only `.js` gets synced.

```
src/
  Scripts/
    shared/core/ServiceContainer.ts
    modules/cp/core/ContentPipeline.ts
  Actions/
    cp/add-draft-to-pipeline.ts
  Tests/
    unit/cp/text-utilities-test.ts
    fixtures/assertions.ts
Library/                              (build output, .gitignored)
  Scripts/
    shared/core/ServiceContainer.js
    modules/cp/core/ContentPipeline.js
  Actions/
    cp/add-draft-to-pipeline.js
  Tests/
    ...
  Data/                               (not compiled, copied as-is)
  Templates/                          (not compiled, copied as-is)
  Themes/                             (not compiled, copied as-is)
  Scripts/vendor/                     (not compiled, copied as-is)
```

- Clean separation: `src/` is source of truth, `Library/` is build artifact
- `Library/` can be `.gitignored` (or at least `Library/Scripts/` and `Library/Actions/`)
- Non-JS assets (Data, Templates, Themes, vendor) are copied into `Library/` by the build
- Aligns with replacing Gulp — the Bun build script owns the entire `src/ -> Library/ -> iCloud` pipeline
- Mirrors existing `Library/` structure so the mental model stays the same

### Validation Strategy

Before trusting the new pipeline, **diff the transpiled output against the original**:

```bash
# After initial setup, transpile src/ -> Library/
bun build src/**/*.ts --no-bundle --outdir Library/

# Diff against the original JS (committed in git before migration)
diff -rq Library/Scripts/ Library-original/Scripts/ --exclude='vendor'
```

If the transpiled `.js` output is functionally identical to the hand-written `.js` (ignoring whitespace/formatting), the migration is safe without needing to run every action in Drafts. Key things to verify in the diff:
- `require()` paths are preserved (not transformed to `import`)
- `typeof X == "undefined"` guards are untouched
- Private `#fields` and `static` properties pass through unchanged
- Class definitions and method signatures are identical minus type annotations
- No unexpected module wrapper or export boilerplate added

This diff-based validation is the primary safety net. The Drafts MCP server can be used for spot-checking specific actions after, but a clean diff means the runtime behavior is unchanged.
