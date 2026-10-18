#!/usr/bin/env bun
/**
 * Scaffold a new BVR team.
 *
 * Usage:
 *   bun run new-team <id> --name "MS Girls Basketball" --abbr MSGB --sport basketball \
 *     --level ms --season winter --start 2026-10-30 [--calendar MSGB] [--from <team-id>] \
 *     [--max-score 50 --selected-score 10] [--dry-run] [--root <dir>]
 *
 * Appends the team to Library/Data/bvr/teams.yaml (and the sport to
 * sports.yaml if it is new) as text, so the files' comments survive, and
 * copies the --from team's practice plan and game-day project templates with
 * its names swapped for the new team's. Then prints what is left to do by
 * hand. --calendar defaults to the abbr; --from defaults to the newest team at
 * the same level, else in the same sport. --root points at a copy of the repo
 * (it needs Library/Data/bvr/ and Library/Templates/bvr/), for trying it out.
 */
import yaml from "js-yaml";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { repoRoot } from "./lib/drafts-paths";
import {
  appendEntry,
  chooseFromTeam,
  newTeamProblems,
  renderSportEntry,
  renderTeamEntry,
  substitute,
  substitutionsFor,
  type ExistingTeam,
  type NewTeamOptions,
  type SportSettings,
} from "./lib/new-team";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const valueFlags = ["--name", "--abbr", "--sport", "--level", "--season", "--start", "--calendar", "--from", "--max-score", "--selected-score", "--root"];

// The value after a flag. A missing value, or another flag in its place, is
// an error rather than a value.
function option(name: string): string | undefined {
  const at = args.indexOf(name);
  if (at == -1) return undefined;
  const value = args[at + 1];
  if (value == undefined || value.startsWith("--")) throw new Error(`${name} needs a value`);
  return value;
}

// The first argument that is neither a flag nor a flag's value.
function teamID(): string | undefined {
  return args.find((arg, i) => !arg.startsWith("--") && !valueFlags.includes(args[i - 1]));
}

const dryRun = flag("--dry-run");

function run() {
  const root = resolve(option("--root") ?? repoRoot);
  const dataDir = join(root, "Library", "Data", "bvr");
  const templatesDir = join(root, "Library", "Templates", "bvr");
  const teamsFile = join(dataDir, "teams.yaml");
  const sportsFile = join(dataDir, "sports.yaml");

  const teamsText = readFileSync(teamsFile, "utf8");
  const sportsText = readFileSync(sportsFile, "utf8");
  const existing = ((yaml.load(teamsText) as { teamsData?: ExistingTeam[] }).teamsData ?? []);
  const sports = (yaml.load(sportsText) ?? {}) as Record<string, SportSettings>;
  const levels = existsSync(join(dataDir, "levels"))
    ? [...new Bun.Glob("*.yaml").scanSync({ cwd: join(dataDir, "levels") })].map((file) => file.replace(/\.yaml$/, ""))
    : [];

  const options: Partial<NewTeamOptions> = {
    id: teamID(),
    name: option("--name"),
    abbr: option("--abbr"),
    sport: option("--sport"),
    level: option("--level"),
    season: option("--season"),
    start: option("--start"),
    calendar: option("--calendar"),
  };
  const problems = newTeamProblems(options, existing, levels);
  if (problems.length > 0) throw new Error(`Cannot add the team:\n  - ${problems.join("\n  - ")}`);
  const team = options as NewTeamOptions;

  const fromID = option("--from");
  const from = fromID ? existing.find((t) => t.id == fromID) : chooseFromTeam(existing, team.level, team.sport);
  if (from == undefined) throw new Error(fromID ? `--from ${fromID} is not in teams.yaml` : "No team to copy from; pass --from <team-id>");
  console.log(`Copying from ${from.id}${fromID ? "" : " (newest team at the same level or sport)"}`);

  // teams.yaml
  const entry = renderTeamEntry(team);
  console.log(`\n${dryRun ? "Would append" : "Appending"} to ${teamsFile}:\n${entry}`);
  if (!dryRun) writeFileSync(teamsFile, appendEntry(teamsText, entry));

  // sports.yaml, only for a new sport
  if (sports[team.sport] == undefined) {
    const settings = sportSettings(sports[from.sport]);
    const sportEntry = renderSportEntry(team.sport, settings);
    console.log(`${dryRun ? "Would append" : "Appending"} to ${sportsFile}:\n${sportEntry}`);
    if (!dryRun) writeFileSync(sportsFile, appendEntry(sportsText, sportEntry));
  } else {
    console.log(`${team.sport} is already in sports.yaml`);
  }

  // Templates copied from the --from team
  const pairs = substitutionsFor(from, team);
  for (const suffix of ["practice-plan.md", "game-day-project.mustache"]) {
    const source = join(templatesDir, `${from.id}-${suffix}`);
    const target = join(templatesDir, `${team.id}-${suffix}`);
    if (existsSync(target)) {
      console.log(`\nSkipped ${target}: it already exists`);
      continue;
    }
    if (!existsSync(source)) {
      console.log(`\nSkipped ${target}: ${from.id} has no ${suffix}`);
      continue;
    }
    const { text, replaced } = substitute(readFileSync(source, "utf8"), pairs);
    console.log(`\n${dryRun ? "Would create" : "Created"} ${target} from ${from.id}-${suffix}`);
    replaced.forEach((r) => console.log(`  replaced "${r.from}" with "${r.to}" (${r.count}x)`));
    if (replaced.length == 0) console.log("  nothing to replace; review it by hand");
    if (!dryRun) writeFileSync(target, text);
  }

  printChecklist(team);
}

// Score picker settings for a new sport: the flags, else the --from team's sport.
function sportSettings(fromSport: SportSettings | undefined): SportSettings {
  const maxScore = option("--max-score");
  const selected = option("--selected-score");
  const settings = {
    maxScore: maxScore != undefined ? Number(maxScore) : fromSport?.maxScore,
    selectedValue: selected != undefined ? Number(selected) : fromSport?.selectedValue,
  };
  if (!Number.isInteger(settings.maxScore) || !Number.isInteger(settings.selectedValue)) {
    throw new Error("New sport: pass --max-score and --selected-score (whole numbers)");
  }
  return settings as SportSettings;
}

function printChecklist(team: NewTeamOptions) {
  const calendar = team.calendar ?? team.abbr;
  console.log(`
Left to do by hand:
  1. Review the new templates in Library/Templates/bvr/ and the teams.yaml entry
     (add assistantCoaches, templateTags, or overrides of the ${team.level} level if needed).
  2. Create a calendar named "${calendar}" for the team's games.
  3. Add a Things project template for game days if the team uses one.
  4. Make sure the Shortcuts "Mark Attendace As Complete" and "Complete Game Day Tasks"
     handle the abbr ${team.abbr}.
  5. bun run sync
  6. bun run bvr:migrate   (gives ${team.id} its team file and ${team.start.slice(0, 4)}-${team.season} season)
  7. In Drafts, run Start New Season and pick ${team.name}: it creates the season record
     draft and the roster draft (there is no attendance draft to set by hand).`);
}

try {
  run();
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
