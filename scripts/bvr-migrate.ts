#!/usr/bin/env bun
/**
 * Move BVR runtime data between the old files and the per-team files.
 *
 * Usage:
 *   bun run bvr:migrate [--dry-run]                       records.json + practicePlans.json → teams/<id>.json
 *   bun run bvr:migrate --verify                          compare the two without writing anything
 *   bun run bvr:migrate --reverse --out <dir> [--dry-run] team files → records.json + practicePlans.json in <dir>
 *
 * Forward reads the old files and the committed teams.yaml, and writes one
 * team file per team into the teams folder beside them, after a backup. It
 * never changes records.json or practicePlans.json, and a re-run only adds
 * what the team files are missing.
 *
 * Reverse lays the team files over the current old files so main can see
 * games recorded on the branch. It only writes to --out, never over the live
 * files: copy the two files into place yourself after a backup.
 *
 * Output is counts and draft IDs only, never game contents. DRAFTS_DEST
 * points every direction at a scratch Drafts folder instead of iCloud.
 */
import yaml from "js-yaml";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { backupBvrData } from "./lib/bvr-backup";
import { bvrDataDir, defaultDraftsDest, repoRoot, repoTeamsYaml } from "./lib/drafts-paths";
import {
  forwardMigrate,
  isClean,
  isSafeTeamID,
  reverseMigrate,
  teamFileProblem,
  verifyMigration,
  type LegacyPracticePlans,
  type LegacyRecords,
  type SeasonSummary,
  type TeamConfig,
  type TeamFile,
  type TeamFiles,
} from "./lib/bvr-team-file";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
// The value after an option. A missing value, or another option in its
// place (`--out --dry-run`), is an error rather than a folder name.
const option = (name: string) => {
  const at = args.indexOf(name);
  if (at == -1) return undefined;
  const value = args[at + 1];
  if (value == undefined || value.startsWith("--")) throw new Error(`${name} needs a value`);
  return value;
};

const dryRun = flag("--dry-run");
const dataDir = bvrDataDir();
const recordsFile = "records.json";
const practicePlansFile = "practicePlans.json";

// --- reading -----------------------------------------------------------------

async function readJSON<T>(path: string, fallback: T): Promise<T> {
  if (!existsSync(path)) return fallback;
  return (await Bun.file(path).json()) as T;
}

async function readYaml<T>(path: string): Promise<T> {
  return yaml.load(await Bun.file(path).text()) as T;
}

// The teams folder name comes from settings.tpl (teamFilesDir), the same key
// the Drafts scripts read, so the two cannot drift apart. It is not a secret.
async function teamsDir(): Promise<string> {
  const settings = await readYaml<{ teamFilesDir?: string }>(join(repoRoot, "Library", "Data", "bvr", "settings.tpl"));
  return join(dataDir, (settings.teamFilesDir ?? "teams/").replace(/\/$/, ""));
}

async function readTeams(): Promise<TeamConfig[]> {
  const { teamsData } = await readYaml<{ teamsData: TeamConfig[] }>(repoTeamsYaml);
  const unsafe = teamsData.filter((team) => !isSafeTeamID(`${team.id}`));
  if (unsafe.length > 0) throw new Error(`teams.yaml has team IDs that are not safe file names: ${unsafe.map((t) => t.id).join(", ")}`);
  return teamsData;
}

async function readLegacy(): Promise<{ records: LegacyRecords; practicePlans: LegacyPracticePlans }> {
  if (!existsSync(join(dataDir, recordsFile))) console.warn(`No ${recordsFile} in ${dataDir}`);
  return {
    records: await readJSON<LegacyRecords>(join(dataDir, recordsFile), {}),
    practicePlans: await readJSON<LegacyPracticePlans>(join(dataDir, practicePlansFile), {}),
  };
}

// Every team file in dir. Any file that is not a usable team file (half
// synced, hand edited, unknown schema) stops the run, so it is never merged
// into or overwritten.
async function readTeamFiles(dir: string): Promise<TeamFiles> {
  const teamFiles: TeamFiles = {};
  if (!existsSync(dir)) return teamFiles;
  for (const file of new Bun.Glob("*.json").scanSync({ cwd: dir })) {
    const path = join(dir, file);
    let data: unknown;
    try {
      data = await Bun.file(path).json();
    } catch {
      data = undefined;
    }
    const problem = teamFileProblem(data);
    if (problem) throw new Error(`${path} cannot be used: ${problem}. Wait for iCloud or restore it from a backup.`);
    const teamFile = data as TeamFile;
    if (!isSafeTeamID(teamFile.teamID)) throw new Error(`${path} has an unsafe teamID`);
    teamFiles[teamFile.teamID] = teamFile;
  }
  return teamFiles;
}

// --- writing and reporting -----------------------------------------------------

const toJSON = (data: unknown) => JSON.stringify(data, null, 2) + "\n";

// Write a file unless it already holds the same data. Returns whether it wrote.
async function writeIfChanged(path: string, data: unknown): Promise<boolean> {
  const content = toJSON(data);
  if (existsSync(path) && (await Bun.file(path).text()) == content) return false;
  await writeFile(path, content);
  return true;
}

async function backupFirst() {
  const { folder, files } = await backupBvrData(dataDir);
  if (folder == undefined) throw new Error(`Nothing to back up in ${dataDir}; refusing to write`);
  console.log(`Backed up ${files.length} files to ${folder}`);
}

const today = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

function printSummary(summary: SeasonSummary[]) {
  for (const row of summary) {
    const games = `games ${String(row.games).padStart(3)} (+${row.gamesAdded})`;
    const plans = `practice plans ${String(row.practicePlans).padStart(3)} (+${row.plansAdded})`;
    console.log(`  ${row.teamID.padEnd(16)} ${row.seasonID.padEnd(14)} ${games}   ${plans}`);
  }
}

function printWarnings(warnings: string[]) {
  if (warnings.length == 0) return;
  console.warn(`WARNINGS (${warnings.length}):`);
  warnings.forEach((warning) => console.warn(`  ! ${warning}`));
}

// --- directions --------------------------------------------------------------

async function forward() {
  const dir = await teamsDir();
  const teams = await readTeams();
  const existing = await readTeamFiles(dir);
  const { teamFiles, summary, warnings } = forwardMigrate({ ...(await readLegacy()), teams, existing, today: today() });

  console.log(`Team files from ${dataDir}:`);
  printSummary(summary);
  printWarnings(warnings);
  for (const file of Object.values(teamFiles)) console.log(`  ${file.teamID}: current season ${file.currentSeason}`);

  if (dryRun) return console.log(`Dry run: would write ${Object.keys(teamFiles).length} team files to ${dir}`);

  await backupFirst();
  await mkdir(dir, { recursive: true });
  for (const [teamID, file] of Object.entries(teamFiles)) {
    const path = join(dir, `${teamID}.json`);
    console.log(`  ${(await writeIfChanged(path, file)) ? "Wrote" : "Unchanged"} ${path}`);
  }
}

// Where reverse writes. The live folder is refused, so the migration never
// rewrites the files it reads.
function reverseTarget(): string | undefined {
  const out = option("--out");
  if (out == undefined) return undefined;
  const target = resolve(out);
  const liveFolders = [dataDir, bvrDataDir(defaultDraftsDest)].map(comparablePath);
  if (liveFolders.includes(comparablePath(target))) {
    throw new Error("--out is a live data folder; write elsewhere and copy the files over");
  }
  return target;
}

// A path with symlinks resolved and case folded, for comparing folders on a
// case-insensitive disk. The folder need not exist: the deepest existing
// parent is resolved and the rest appended.
function comparablePath(path: string): string {
  let existing = resolve(path);
  const rest: string[] = [];
  while (!existsSync(existing) && dirname(existing) != existing) {
    rest.unshift(basename(existing));
    existing = dirname(existing);
  }
  return join(realpathSync(existing), ...rest).toLowerCase();
}

async function reverse() {
  const target = reverseTarget();
  if (target == undefined && !dryRun) {
    throw new Error("--reverse needs --out <dir> (any folder except the live data folder)");
  }

  const teamFiles = await readTeamFiles(await teamsDir());
  if (Object.keys(teamFiles).length == 0) throw new Error(`No team files in ${await teamsDir()}`);
  const { records, practicePlans, summary, warnings } = reverseMigrate({ teamFiles, ...(await readLegacy()) });

  console.log(`Old files rebuilt from team files (+ = new to the old files):`);
  printSummary(summary);
  printWarnings(warnings);

  if (dryRun) return console.log(`Dry run: would write ${recordsFile} and ${practicePlansFile} to ${target ?? "<--out dir>"}`);
  if (target == undefined) return;

  await mkdir(target, { recursive: true });
  for (const [name, data] of [[recordsFile, records], [practicePlansFile, practicePlans]] as const) {
    const path = join(target, name);
    console.log(`  ${(await writeIfChanged(path, data)) ? "Wrote" : "Unchanged"} ${path}`);
  }
}

async function verify() {
  const rows = verifyMigration({ ...(await readLegacy()), teamFiles: await readTeamFiles(await teamsDir()) });
  const list = (label: string, ids: string[]) => ids.length > 0 && console.log(`      ${label}: ${ids.join(", ")}`);

  for (const row of rows) {
    const status = isClean(row) ? "ok  " : "DIFF";
    const extra = row.teamFileOnlyGames > 0 ? `, ${row.teamFileOnlyGames} only in the team file` : "";
    console.log(`  ${status} ${row.teamID.padEnd(16)} ${row.year}  ${row.legacyGames} games in ${recordsFile}${extra}`);
    list("missing from team file", row.missingGames);
    list("different in team file", row.changedGames);
    list("practice plans missing", row.missingPlans);
    list("practice plans different", row.changedPlans);
  }

  const dirty = rows.filter((row) => !isClean(row)).length;
  console.log(dirty == 0 ? "Everything in the old files is in the team files." : `${dirty} team-years differ.`);
  if (dirty > 0) process.exitCode = 1;
}

try {
  if (flag("--verify")) await verify();
  else if (flag("--reverse")) await reverse();
  else await forward();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
