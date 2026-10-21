# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains JavaScript scripts and templates for the [Drafts app](https://getdrafts.com) on iOS and macOS. The scripts extend Drafts functionality with integrations to NocoDB, Ulysses, Bear, and other apps. NocoDB is the production data source as of October 2026; the Airtable code remains but is legacy.

## Development Commands

The build runs on Bun (`scripts/build.ts`). Gulp is still installed as a fallback while the Bun pipeline proves itself.

- `bun run sync` - Full pipeline: pull runtime JSON from iCloud, inject secrets, convert YAML to JSON, push `Library/` to iCloud, then delete the rendered `.yaml` files so secrets and contact details do not stay on disk. Always runs every step
- `bun run watch` - Run `sync` once, then rebuild on every change under `Library/`
- `bun run debug` - Display sync paths for debugging
- `bun run test [filter] [--all]` - Run unit tests locally under Bun with a Drafts-style `require()` shim. Covers loading and pure logic only; tests that touch Drafts objects (Draft, editor, Workspace, ...) are reported as "needs Drafts" and must run in the app
- `bun run test:scripts` - Run the `bun test` suites for the Bun tooling in `scripts/` (`*.test.ts`, such as the BVR team file migration). `bun run test` cannot load TypeScript, so these live apart from `Library/Tests/`
- `bun run typecheck` - Type-check the scripts against `types/` (see `scripts/typecheck.ts`). Fails only on errors not in `scripts/typecheck-baseline.json`; `--all` shows every error, `--update-baseline` rewrites the baseline after fixing one (also update `docs/reference/typecheck-findings.md`)
- `bun run inject [--force]` - Render `<name>.yaml.tpl` files to `<name>.yaml` with the 1Password CLI. Skips templates whose content has not changed since the last render and whose `.json` is still exactly what that render produced (both tracked by hash in `.build/inject-manifest.json`); `--force` renders all, e.g. after rotating a secret
- `bun run data` - Copy runtime JSON from iCloud to local Library: only `.json` with no source in the repo (records, practice plans, team files, recent records). JSON built from a `.yaml` or `.yaml.tpl`, and committed JSON, is never pulled, so a stale iCloud copy cannot replace it
- `bun run yaml2json` - Convert YAML config files to JSON (runs automatically during sync)
- `bun run clean` - Delete the `.yaml` files rendered from `.yaml.tpl` files (`sync` already does this as its last step)
- `bun run checkpoint [promote]` - Report which dev commits have settled enough to move to main; `promote` fast-forwards main and tags it (see the `drafts-change-workflow` skill)
- `bun run bvr:backup` - Copy every `.json` under the Drafts `Library/Data/bvr/` to `~/Backups/drafts-bvr/<YYYY-MM-DD_HHMMSS>/` and print the folder. Plain copy, contents never printed. `BVR_BACKUP_DIR` changes the backup root; `DRAFTS_DEST` changes the source
- `bun run bvr:migrate [--dry-run]` - Back up, then fold `records.json` and `practicePlans.json` into one `Library/Data/bvr/teams/<teamID>.json` per team in the Drafts folder. Never changes the old files; safe to re-run. `--verify` compares the two sides; `--reverse --out <dir>` rebuilds the old files for `main` into `<dir>`. See `docs/reference/bvr-team-file.md`
- `bun run new-team <id> --name "..." --abbr ABBR --sport <sport> --level ms|us --season fall|winter|spring --start YYYY-MM-DD [--calendar] [--from <team-id>] [--max-score N --selected-score N] [--dry-run]` - Scaffold a BVR team: appends it to `teams.yaml` (and a new sport to `sports.yaml`) as text, copies the `--from` team's practice plan and game-day templates with its names swapped, and prints the manual checklist. `--root <dir>` runs it against a copy of the repo
- `bun run gulp:sync`, `gulp:watch`, `gulp:debug` - The old Gulp pipeline, same behavior

`DRAFTS_DEST=/some/scratch/dir bun run sync` sends the pipeline to a scratch folder instead of iCloud. Use it to try build changes without touching the live Drafts library.

## Architecture

### Directory Structure

- `Library/` - Main source directory containing all Drafts resources
  - `Scripts/` - JavaScript files organized by functionality
  - `Templates/` - Markdown templates for various use cases
  - `Data/` - YAML/JSON configuration and data files
  - `Themes/` - Drafts theme files
  - `Tests/` - Test suite (unit and integration tests)
- `scripts/build.ts` - Build pipeline that syncs files to iCloud Drafts directory (`gulpfile.js` is the legacy equivalent)
- `types/` - Drafts type definitions for `bun run typecheck` (see `types/README.md`)

### Module Path Convention

**IMPORTANT**: All `require()` statements use `Library/Scripts/` as the base path, regardless of the file's location.

This means:
- Files in `Library/Scripts/modules/cp/core/` use paths like `modules/cp/utils/TextUtilities.js`
- Files in `Library/Scripts/shared/core/` use paths like `shared/core/ServiceContainer.js`
- Files in `Library/Tests/unit/cp/` use paths like `../Tests/fixtures/assertions.js`
- Files in `Library/Actions/` use paths like `modules/cp/core/ContentPipeline.js`

**Examples:**

```javascript
// From Library/Scripts/modules/cp/core/ContentPipeline.js
require("modules/cp/utils/TextUtilities.js");           // ✅ Correct
require("shared/core/ServiceContainer.js");             // ✅ Correct
require("../utils/TextUtilities.js");                   // ❌ Wrong - don't use relative paths

// From Library/Tests/unit/cp/text-utilities-test.js
require("../Tests/fixtures/assertions.js");             // ✅ Correct (relative to Library/Scripts/)
require("modules/cp/utils/TextUtilities.js");           // ✅ Correct
require("../../fixtures/assertions.js");                // ❌ Wrong - base is always Library/Scripts/

// From Library/Actions/cp/add-to-pipeline.js
require("modules/cp/core/ContentPipeline.js");          // ✅ Correct
require("shared/core/ServiceInitializer.js");           // ✅ Correct
```

**Why this matters:**
- Drafts runs all scripts with `Library/Scripts/` as the working directory
- Using consistent paths prevents "module not found" errors
- Makes refactoring easier since paths don't change when files move
- All documentation and examples follow this convention

### Key Components

**Core Libraries (`Library/Scripts/shared/libraries/`)**:
- `nocodb.js` - NocoDB API wrapper (primary data source)
- `airtable-v2.js` - Airtable API wrapper (legacy, no longer production)
- `ulysses.js` - Ulysses app integration
- `bear.js` - Bear notes app integration

**Project Modules**:
- `cp/` - Content Pipeline system for managing writing workflows
- `bvr/` - Sports team management (attendance, scores, messaging)
- `nr/` - Personal productivity and note-taking utilities

**Framework Classes**:
- `Airtable`, `ATBase`, `ATTable` - Airtable wrapper, base, and table query classes (legacy)
- `RecentRecords` - Caches frequently accessed records
- `Sport` - Sports-specific configuration management

### Configuration System

The project uses a build-time compilation approach for configuration:
- Template files (`<name>.yaml.tpl`) contain secrets managed by 1Password CLI. The name says what they render to, and editors highlight them as YAML
- YAML files (`.yaml`) are human-friendly source files for configuration
- JSON files (`.json`) are build artifacts generated from YAML files at build time
- Scripts load JSON files at runtime (no YAML parsing overhead)
- YAML files should be edited for configuration changes; JSON files are auto-generated

BVR settings are layered (`Library/Scripts/modules/bvr/utils/TeamConfig.js` merges them):
- `bvr/staff.yaml.tpl` - The only BVR file with contact details: people keyed by initials. Everything else names people by initials
- `bvr/levels/ms.yaml`, `bvr/levels/us.yaml` - Defaults per level: who gets absence and score messages, which forms to submit
- `bvr/forms.yaml` - School-wide score-form field maps. Form links are per term and shared by every team in it (`bvr/formLinks.json`, runtime, entered in Drafts; see `docs/reference/bvr-team-file.md`)
- `bvr/teams.yaml` - Per team: level, attendance draft, assistant coaches, plain template tags, and only what differs from its level. Tags and template file names are derived from `id` and `defaultTag` (see the comment at the top of the file)
- There are no per-team settings folders; a new team needs only a `teams.yaml` entry

### Sync Workflow

Files are developed locally in `Library/` and synchronized to the iCloud Drafts directory at:
`~/Library/Mobile Documents/iCloud~com~agiletortoise~Drafts5/Documents/`

The sync process:
1. Copies JSON data from iCloud to local
2. Processes template files to inject secrets (`.yaml.tpl` → `.yaml`)
3. Converts YAML config files to JSON (`.yaml` → `.json`)
4. Syncs all files to iCloud Drafts directory
5. Optionally watches for changes in development mode

## Secret Management

Secrets are managed using 1Password CLI (`op inject`) with template files. Never commit actual API keys or credentials to the repository.