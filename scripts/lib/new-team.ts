/**
 * Pure parts of `bun run new-team`: validating the options, choosing the team
 * to copy from, rendering the teams.yaml and sports.yaml entries as text, and
 * substituting one team's names into another's template files. No file I/O.
 */
import { isSafeTeamID } from "./bvr-team-file";

export interface NewTeamOptions {
  id: string;
  name: string;
  abbr: string;
  sport: string;
  level: string;
  season: string;
  start: string;
  calendar?: string;
}

// The fields of an existing teams.yaml entry this module reads.
export interface ExistingTeam {
  id: string;
  name: string;
  abbr: string;
  sport: string;
  level?: string;
  defaultTag?: string;
  practicePlan?: { draftTags?: string[] };
}

export interface SportSettings {
  maxScore: number;
  selectedValue: number;
}

// Everything wrong with the options, as messages. Empty when they are usable.
export function newTeamProblems(
  options: Partial<NewTeamOptions>,
  existing: ExistingTeam[],
  levels: string[],
): string[] {
  const problems: string[] = [];
  const required: (keyof NewTeamOptions)[] = ["id", "name", "abbr", "sport", "level", "season", "start"];
  for (const key of required) {
    if (!options[key]) problems.push(key == "id" ? "the team id is missing" : `--${key} is required`);
  }

  const { id, abbr, sport, level, season, start, calendar } = options;
  if (id && !isSafeTeamID(id)) problems.push(`"${id}" is not a safe file name (letters, digits, - _ . only)`);
  if (id && existing.some((team) => team.id == id)) problems.push(`${id} is already in teams.yaml`);
  if (abbr && !/^[A-Z0-9]+$/.test(abbr)) problems.push(`--abbr must be capital letters and digits, got "${abbr}"`);
  if (calendar != undefined && calendar.trim() == "") problems.push("--calendar is empty");
  if (sport && !/^[a-z][a-z0-9-]*$/.test(sport)) problems.push(`--sport must be lowercase, got "${sport}"`);
  if (level && !levels.includes(level)) problems.push(`--level must be one of ${levels.join(", ")}, got "${level}"`);
  if (season && !/^[a-z]+$/.test(season)) problems.push(`--season must be one lowercase word (fall, winter, spring), got "${season}"`);
  if (start && !isDate(start)) problems.push(`--start must be a date as YYYY-MM-DD, got "${start}"`);
  return problems;
}

const isDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() == year && date.getUTCMonth() == month - 1 && date.getUTCDate() == day;
};

// The team to copy templates (and missing sport settings) from: the newest
// team (last in teams.yaml) at the same level, else the newest in the sport.
export function chooseFromTeam(existing: ExistingTeam[], level: string, sport: string): ExistingTeam | undefined {
  const newest = (teams: ExistingTeam[]) => teams[teams.length - 1];
  return newest(existing.filter((team) => team.level == level)) ?? newest(existing.filter((team) => team.sport == sport));
}

// Tags follow the pattern the existing teams use.
export const defaultTagFor = (sport: string, level: string) => `bvr/${sport}/${level}`;
export const practicePlanTagFor = (sport: string) => `bvr/${sport}/practice/plan`;

// A YAML scalar as the hand-written entries have it: plain when that is safe,
// double-quoted otherwise. Dates are always quoted, as in the existing file.
export function yamlScalar(value: string, { quote = false } = {}): string {
  if (!quote && /^[A-Za-z][A-Za-z0-9 _./-]*$/.test(value) && !/\s$/.test(value)) return value;
  return JSON.stringify(value);
}

// The new teams.yaml entry, in the key order and style of the existing ones.
export function renderTeamEntry(options: NewTeamOptions): string {
  const calendar = options.calendar ?? options.abbr;
  return [
    `  - id: ${options.id}`,
    `    level: ${options.level}`,
    `    name: ${yamlScalar(options.name)}`,
    `    abbr: ${options.abbr}`,
    `    sport: ${options.sport}`,
    `    season: ${options.season}`,
    `    calendar: ${yamlScalar(calendar)}`,
    `    defaultTag: ${defaultTagFor(options.sport, options.level)}`,
    `    practicePlan:`,
    `      draftTags:`,
    `        - ${practicePlanTagFor(options.sport)}`,
    `    startDate: ${yamlScalar(options.start, { quote: true })}`,
  ].join("\n") + "\n";
}

// A sports.yaml entry, in the file's block style.
export function renderSportEntry(sport: string, settings: SportSettings): string {
  return `${sport}:\n  maxScore: ${settings.maxScore}\n  selectedValue: ${settings.selectedValue}\n`;
}

// Append an entry to a file's text, keeping everything before it as is.
export function appendEntry(text: string, entry: string): string {
  const base = text.length == 0 || text.endsWith("\n") ? text : `${text}\n`;
  return base + entry;
}

export interface Substitution {
  from: string;
  to: string;
  count: number;
}

// The old team's name, id, abbr, and tags, paired with the new team's. Longer
// strings first, so a tag is replaced whole before its parts could be.
export function substitutionsFor(from: ExistingTeam, options: NewTeamOptions): { from: string; to: string }[] {
  const pairs = [
    { from: from.name, to: options.name },
    { from: from.id, to: options.id },
    { from: from.abbr, to: options.abbr },
  ];
  if (from.defaultTag) pairs.push({ from: from.defaultTag, to: defaultTagFor(options.sport, options.level) });
  for (const tag of from.practicePlan?.draftTags ?? []) pairs.push({ from: tag, to: practicePlanTagFor(options.sport) });
  return pairs
    .filter((pair) => pair.from && pair.from != pair.to)
    .sort((a, b) => b.from.length - a.from.length);
}

// Replace each old string with the new one, in order, and count what changed.
export function substitute(text: string, pairs: { from: string; to: string }[]): { text: string; replaced: Substitution[] } {
  let result = text;
  const replaced: Substitution[] = [];
  for (const { from, to } of pairs) {
    const count = result.split(from).length - 1;
    if (count == 0) continue;
    result = result.split(from).join(to);
    replaced.push({ from, to, count });
  }
  return { text: result, replaced };
}
