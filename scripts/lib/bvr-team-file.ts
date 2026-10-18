/**
 * Pure transforms between the old BVR runtime files (records.json and
 * practicePlans.json) and the per-team files (teams/<teamID>.json).
 *
 * No file I/O lives here, so every direction can be unit tested with
 * synthetic data. scripts/bvr-migrate.ts does the reading and writing.
 * The team file schema is documented in docs/reference/bvr-team-file.md.
 */

// --- shapes ------------------------------------------------------------------

// A game exactly as Game.toJSON() writes it. Only draftID matters here; every
// other field is carried through untouched.
export interface Game {
  draftID?: string;
  [field: string]: unknown;
}

// One year of records.json. Some 2024 seasons are a bare Game[] instead.
export interface LegacySeason {
  seasonRecordDraftID?: string | null;
  seasonRecordData?: Game[];
  [field: string]: unknown;
}

export type LegacyRecords = Record<string, Record<string, LegacySeason | Game[]>>;

// practicePlans.json: { teamID: { "2026W7": draftID } }. Top-level keys that
// are not teams (practicePlanFile) are left alone.
export type LegacyPracticePlans = Record<string, Record<string, string> | unknown>;

// The fields of a teams.yaml entry this module reads.
export interface TeamConfig {
  id: string;
  season?: string;
  startDate?: string;
}

export interface SeasonEntry {
  label: string;
  startDate: string | null;
  endDate: string | null;
  formURL: string | null;
  recipients: string[] | null;
  attendanceDraftID: string | null;
  seasonRecordDraftID: string | null;
  games: Game[];
  practicePlans: Record<string, string>;
}

export interface TeamFile {
  schemaVersion: 1;
  teamID: string;
  currentSeason: string | null;
  seasons: Record<string, SeasonEntry>;
}

export type TeamFiles = Record<string, TeamFile>;

// Counts only, so a summary can be printed without game contents.
export interface SeasonSummary {
  teamID: string;
  seasonID: string;
  games: number;
  gamesAdded: number;
  practicePlans: number;
  plansAdded: number;
}

export const SCHEMA_VERSION = 1;

// --- season IDs ----------------------------------------------------------------

// "2026" + "fall" → "2026-fall". A team with no season name keeps the bare year.
export function seasonIDFor(year: string | number, seasonName?: string): string {
  return seasonName ? `${year}-${seasonName}` : `${year}`;
}

// "2026-fall" → "2026 Fall". IDs in any other shape ("2026-27") are their own label.
export function seasonLabel(seasonID: string): string {
  const match = /^(\d{4})-([a-z]+)$/i.exec(seasonID);
  if (!match) return seasonID;
  const [, year, name] = match;
  return `${year} ${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

// The calendar year a season ID starts in, which is the key the old code uses.
export function seasonYear(seasonID: string): string | undefined {
  return /^(\d{4})/.exec(seasonID)?.[1];
}

export function emptySeason(seasonID: string, startDate: string | null = null): SeasonEntry {
  return {
    label: seasonLabel(seasonID),
    startDate,
    endDate: null,
    formURL: null,
    recipients: null,
    attendanceDraftID: null,
    seasonRecordDraftID: null,
    games: [],
    practicePlans: {},
  };
}

export function emptyTeamFile(teamID: string): TeamFile {
  return { schemaVersion: SCHEMA_VERSION, teamID, currentSeason: null, seasons: {} };
}

// teams.yaml carries one startDate per team. It belongs to the season of the
// same year; older seasons have no recorded start date.
function startDateFor(team: TeamConfig, year: string): string | null {
  return team.startDate?.startsWith(year) ? team.startDate : null;
}

// Get a season entry, creating it when missing, and fill a missing start date.
function ensureSeason(file: TeamFile, seasonID: string, startDate: string | null): SeasonEntry {
  const entry = (file.seasons[seasonID] ??= emptySeason(seasonID, startDate));
  if (entry.startDate == null && startDate != null) entry.startDate = startDate;
  return entry;
}

// The season a team is in on `today` (YYYY-MM-DD): the newest season that has
// started. A season without a start date counts from Jan 1 of its year. When
// every season is still ahead, the earliest upcoming one.
export function chooseCurrentSeason(seasons: Record<string, SeasonEntry>, today: string): string | null {
  const starts = Object.entries(seasons)
    .map(([id, entry]) => {
      const year = seasonYear(id);
      return { id, start: entry.startDate ?? (year ? `${year}-01-01` : "") };
    })
    .filter(({ start }) => start != "")
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));

  const started = starts.filter(({ start }) => start <= today);
  if (started.length > 0) return started[started.length - 1].id;
  return starts[0]?.id ?? null;
}

// --- games -------------------------------------------------------------------

// Games are matched by draft ID. A game without one is matched by its content,
// which keeps re-runs from duplicating it.
export function gameKey(game: Game): string {
  return game.draftID ? game.draftID : `json:${JSON.stringify(game)}`;
}

// A label safe to print: the draft ID, never the game's contents.
export const gameLabel = (game: Game): string => game.draftID || "(game without draftID)";

// Merge `incoming` into `target`, keeping target's order and appending games it
// lacks. `prefer` decides which copy wins when both hold the same game.
export function mergeGames(
  target: Game[],
  incoming: Game[],
  prefer: "target" | "incoming",
): { games: Game[]; added: number } {
  const games = target.map((game) => structuredClone(game));
  const index = new Map(games.map((game, i) => [gameKey(game), i]));
  let added = 0;

  for (const game of incoming) {
    const key = gameKey(game);
    const at = index.get(key);
    if (at == undefined) {
      index.set(key, games.length);
      games.push(structuredClone(game));
      added++;
    } else if (prefer == "incoming") {
      games[at] = structuredClone(game);
    }
  }
  return { games, added };
}

// A records.json season's games, whichever of the two shapes it has.
const legacyGames = (season: LegacySeason | Game[]): Game[] =>
  Array.isArray(season) ? season : season.seasonRecordData ?? [];

// The object form the old code expects, from either shape.
function legacySeasonObject(season: LegacySeason | Game[] | undefined): LegacySeason {
  if (season == undefined) return {};
  if (Array.isArray(season)) return { seasonRecordDraftID: null, seasonRecordData: structuredClone(season) };
  return structuredClone(season);
}

const isPlanMap = (value: unknown): value is Record<string, string> =>
  typeof value == "object" && value != null && !Array.isArray(value);

// --- forward: old files → team files -----------------------------------------

export interface ForwardInput {
  records: LegacyRecords;
  practicePlans: LegacyPracticePlans;
  teams: TeamConfig[];
  existing?: TeamFiles;
  today: string;
}

export interface ForwardResult {
  teamFiles: TeamFiles;
  summary: SeasonSummary[];
  warnings: string[];
}

// Build one team file per team in teams.yaml. Existing team files are the
// starting point and win wherever both sides hold the same game or plan, so a
// re-run only adds what the team file is missing and never drops anything.
export function forwardMigrate({ records, practicePlans, teams, existing = {}, today }: ForwardInput): ForwardResult {
  const teamFiles: TeamFiles = {};
  const summary: SeasonSummary[] = [];
  const warnings: string[] = [];
  const teamIDs = new Set(teams.map((team) => team.id));

  for (const team of teams) {
    const file = existing[team.id] ? structuredClone(existing[team.id]) : emptyTeamFile(team.id);
    const counts: Record<string, { gamesAdded: number; plansAdded: number }> = {};
    const countFor = (seasonID: string) => (counts[seasonID] ??= { gamesAdded: 0, plansAdded: 0 });
    if (!team.season) warnings.push(`${team.id}: no season in teams.yaml, so its season IDs are bare years`);

    for (const [year, season] of Object.entries(records[team.id] ?? {})) {
      if (!/^\d{4}$/.test(year)) {
        warnings.push(`${team.id}: skipped records.json key "${year}", which is not a year`);
        continue;
      }
      const seasonID = seasonIDFor(year, team.season);
      const entry = ensureSeason(file, seasonID, startDateFor(team, year));
      const { games, added } = mergeGames(entry.games, legacyGames(season), "target");
      entry.games = games;
      countFor(seasonID).gamesAdded += added;

      const legacyDraftID = Array.isArray(season) ? undefined : season.seasonRecordDraftID;
      if (!entry.seasonRecordDraftID && legacyDraftID != undefined) entry.seasonRecordDraftID = legacyDraftID;
    }

    const plans = practicePlans[team.id];
    for (const [planID, draftID] of Object.entries(isPlanMap(plans) ? plans : {})) {
      const match = /^(\d{4})(W\d+)$/.exec(planID);
      if (!match) {
        warnings.push(`${team.id}: skipped practice plan key "${planID}", which is not <year>W<week>`);
        continue;
      }
      const [, year, week] = match;
      const seasonID = seasonIDFor(year, team.season);
      const entry = ensureSeason(file, seasonID, startDateFor(team, year));
      if (entry.practicePlans[week] == undefined) {
        entry.practicePlans[week] = draftID;
        countFor(seasonID).plansAdded++;
      } else if (entry.practicePlans[week] != draftID) {
        warnings.push(`${team.id}: kept the team file's plan for ${seasonID} ${week}; practicePlans.json points elsewhere`);
      }
    }

    // The season teams.yaml describes exists even before its first game.
    if (team.startDate) {
      const year = team.startDate.slice(0, 4);
      ensureSeason(file, seasonIDFor(year, team.season), team.startDate);
    }

    // An explicit choice (from Start New Season or an earlier run) is kept.
    if (file.currentSeason == null || file.seasons[file.currentSeason] == undefined) {
      file.currentSeason = chooseCurrentSeason(file.seasons, today);
    }

    teamFiles[team.id] = file;
    for (const [seasonID, entry] of Object.entries(file.seasons).sort(([a], [b]) => a.localeCompare(b))) {
      summary.push({
        teamID: team.id,
        seasonID,
        games: entry.games.length,
        gamesAdded: counts[seasonID]?.gamesAdded ?? 0,
        practicePlans: Object.keys(entry.practicePlans).length,
        plansAdded: counts[seasonID]?.plansAdded ?? 0,
      });
    }
  }

  for (const teamID of Object.keys(records)) {
    if (!teamIDs.has(teamID)) warnings.push(`${teamID}: in records.json but not in teams.yaml, so not migrated`);
  }
  for (const [teamID, plans] of Object.entries(practicePlans)) {
    if (isPlanMap(plans) && !teamIDs.has(teamID)) {
      warnings.push(`${teamID}: in practicePlans.json but not in teams.yaml, so not migrated`);
    }
  }

  return { teamFiles, summary, warnings };
}

// --- reverse: team files → old files -------------------------------------------

export interface ReverseInput {
  teamFiles: TeamFiles;
  // The current old files. The team files are laid over them, so anything the
  // team files do not cover (other teams, extra keys) survives the round trip.
  records?: LegacyRecords;
  practicePlans?: LegacyPracticePlans;
}

export interface ReverseResult {
  records: LegacyRecords;
  practicePlans: LegacyPracticePlans;
  summary: SeasonSummary[];
  warnings: string[];
}

// Rebuild records.json and practicePlans.json for the old code. Each season
// lands under the calendar year it starts in. Team-file games and plans win
// over the old files', and old-file games the team file lacks are kept.
export function reverseMigrate({ teamFiles, records = {}, practicePlans = {} }: ReverseInput): ReverseResult {
  const outRecords: LegacyRecords = structuredClone(records);
  const outPlans: LegacyPracticePlans = structuredClone(practicePlans);
  const summary: SeasonSummary[] = [];
  const warnings: string[] = [];

  for (const [teamID, file] of Object.entries(teamFiles)) {
    const teamRecords = (outRecords[teamID] ??= {});
    const existingPlans = outPlans[teamID];
    const teamPlans: Record<string, string> = isPlanMap(existingPlans) ? existingPlans : {};
    const seasonForYear: Record<string, string> = {};

    for (const [seasonID, entry] of Object.entries(file.seasons).sort(([a], [b]) => a.localeCompare(b))) {
      const year = seasonYear(seasonID);
      if (!year) {
        warnings.push(`${teamID}: season "${seasonID}" has no leading year, so the old code cannot see it`);
        continue;
      }
      if (seasonForYear[year]) {
        warnings.push(`${teamID}: seasons ${seasonForYear[year]} and ${seasonID} both map to ${year}; merged`);
      }
      seasonForYear[year] = seasonID;

      const season = legacySeasonObject(teamRecords[year]);
      const { games, added } = mergeGames(season.seasonRecordData ?? [], entry.games, "incoming");
      season.seasonRecordData = games;
      if (entry.seasonRecordDraftID || season.seasonRecordDraftID == undefined) {
        season.seasonRecordDraftID = entry.seasonRecordDraftID;
      }
      teamRecords[year] = season;

      let plansAdded = 0;
      for (const [week, draftID] of Object.entries(entry.practicePlans)) {
        const planID = `${year}${week}`;
        if (teamPlans[planID] != draftID) plansAdded++;
        teamPlans[planID] = draftID;
      }

      // Only write a plan map when there is one: the old code reads an empty
      // map as "plans exist" and then fails to find the draft.
      if (Object.keys(teamPlans).length > 0) outPlans[teamID] = teamPlans;

      summary.push({
        teamID,
        seasonID,
        games: games.length,
        gamesAdded: added,
        practicePlans: Object.keys(entry.practicePlans).length,
        plansAdded,
      });
    }
  }

  return { records: outRecords, practicePlans: outPlans, summary, warnings };
}

// --- verify ------------------------------------------------------------------

export interface VerifyRow {
  teamID: string;
  year: string;
  legacyGames: number;
  // Draft IDs only, so the result is safe to print.
  missingGames: string[];
  changedGames: string[];
  teamFileOnlyGames: number;
  missingPlans: string[];
  changedPlans: string[];
}

// Compare the old files against what the team files would rebuild on their
// own. A clean row means switching back to main loses nothing for that year;
// teamFileOnlyGames are games main cannot see until a reverse run.
export function verifyMigration(input: {
  records: LegacyRecords;
  practicePlans: LegacyPracticePlans;
  teamFiles: TeamFiles;
}): VerifyRow[] {
  const rebuilt = reverseMigrate({ teamFiles: input.teamFiles });
  const rows: Record<string, VerifyRow> = {};
  const rowFor = (teamID: string, year: string) =>
    (rows[`${teamID}/${year}`] ??= {
      teamID,
      year,
      legacyGames: 0,
      missingGames: [],
      changedGames: [],
      teamFileOnlyGames: 0,
      missingPlans: [],
      changedPlans: [],
    });

  const teamIDs = new Set([...Object.keys(input.records), ...Object.keys(rebuilt.records)]);
  for (const teamID of teamIDs) {
    const years = new Set([
      ...Object.keys(input.records[teamID] ?? {}),
      ...Object.keys(rebuilt.records[teamID] ?? {}),
    ]);
    for (const year of years) {
      const old = legacyGames(input.records[teamID]?.[year] ?? []);
      const fresh = legacyGames(rebuilt.records[teamID]?.[year] ?? []);
      const freshByKey = new Map(fresh.map((game) => [gameKey(game), game]));
      const oldKeys = new Set(old.map(gameKey));
      const row = rowFor(teamID, year);
      row.legacyGames = old.length;

      for (const game of old) {
        const match = freshByKey.get(gameKey(game));
        if (match == undefined) row.missingGames.push(gameLabel(game));
        else if (JSON.stringify(match) != JSON.stringify(game)) row.changedGames.push(gameLabel(game));
      }
      row.teamFileOnlyGames = fresh.filter((game) => !oldKeys.has(gameKey(game))).length;
    }
  }

  for (const [teamID, plans] of Object.entries(input.practicePlans)) {
    if (!isPlanMap(plans)) continue;
    const fresh = rebuilt.practicePlans[teamID];
    const freshPlans: Record<string, string> = isPlanMap(fresh) ? fresh : {};
    for (const [planID, draftID] of Object.entries(plans)) {
      const row = rowFor(teamID, planID.slice(0, 4));
      if (freshPlans[planID] == undefined) row.missingPlans.push(planID);
      else if (freshPlans[planID] != draftID) row.changedPlans.push(planID);
    }
  }

  return Object.values(rows).sort((a, b) => a.teamID.localeCompare(b.teamID) || a.year.localeCompare(b.year));
}

// A row with nothing missing or changed.
export const isClean = (row: VerifyRow): boolean =>
  row.missingGames.length + row.changedGames.length + row.missingPlans.length + row.changedPlans.length == 0;
