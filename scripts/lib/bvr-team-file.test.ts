/**
 * Tests for the BVR team file migration, run with `bun run test:scripts`.
 * All data here is synthetic; no real records are read.
 */
import { describe, expect, test } from "bun:test";
import {
  chooseCurrentSeason,
  emptySeason,
  forwardMigrate,
  isClean,
  mergeGames,
  reverseMigrate,
  seasonIDFor,
  seasonLabel,
  seasonYear,
  verifyMigration,
  type Game,
  type LegacySeason,
  type LegacyPracticePlans,
  type LegacyRecords,
  type TeamConfig,
  type TeamFiles,
} from "./bvr-team-file";

// A game in the shape Game.toJSON() writes.
function game(draftID: string, overrides: Partial<Game> = {}): Game {
  return {
    calOpponent: "Rivals",
    calLocation: "Home",
    opponent: "Rivals",
    location: "Home",
    date: "2026-03-10T22:00:00.000Z",
    score: ["7", "5"],
    result: "Win",
    formattedDate: "03-10-2026",
    descrition: undefined,
    draftID,
    highlights: "",
    comments: "",
    recorded: true,
    appended: true,
    submitted: false,
    ...overrides,
  };
}

const teams: TeamConfig[] = [
  { id: "us-ultimate", season: "spring", startDate: "2026-03-02" },
  { id: "ms-ultimate", season: "spring", startDate: "2025-03-02" },
  { id: "msg-soccer", season: "fall", startDate: "2026-08-31" },
];

function legacyRecords(): LegacyRecords {
  return {
    "us-ultimate": {
      "2024": [game("G-2024-A"), game("G-2024-B")],
      "2025": { seasonRecordDraftID: "REC-2025", seasonRecordData: [game("G-2025-A")] },
      "2026": { seasonRecordDraftID: "REC-2026", seasonRecordData: [game("G-2026-A"), game("G-2026-B")] },
    },
    "msg-soccer": {
      "2025": { seasonRecordDraftID: "", seasonRecordData: [game("S-2025-A")] },
      "2026": { seasonRecordDraftID: "SREC-2026", seasonRecordData: [game("S-2026-A")] },
    },
    "old-team": { "2024": [game("O-2024-A")] },
  };
}

function legacyPlans(): LegacyPracticePlans {
  return {
    practicePlanFile: "not-a-team.md",
    "us-ultimate": { "2026W7": "PP-26-7", "2024W10": "PP-24-10" },
    "msg-soccer": { "2026W1": "SPP-26-1", "2026W2": "SPP-26-2" },
  };
}

const today = "2026-10-18";

const migrate = (existing?: TeamFiles) =>
  forwardMigrate({ records: legacyRecords(), practicePlans: legacyPlans(), teams, existing, today });

describe("season IDs", () => {
  test("build IDs from year and season name", () => {
    expect(seasonIDFor(2026, "fall")).toBe("2026-fall");
    expect(seasonIDFor("2026")).toBe("2026");
  });

  test("label reads like a title", () => {
    expect(seasonLabel("2026-fall")).toBe("2026 Fall");
    expect(seasonLabel("2026-27")).toBe("2026-27");
    expect(seasonLabel("Winter League")).toBe("Winter League");
  });

  test("year is the leading four digits", () => {
    expect(seasonYear("2026-27")).toBe("2026");
    expect(seasonYear("winter")).toBeUndefined();
  });
});

describe("chooseCurrentSeason", () => {
  const seasons = {
    "2025-fall": emptySeason("2025-fall", "2025-09-01"),
    "2026-fall": emptySeason("2026-fall", "2026-08-31"),
    "2027-fall": emptySeason("2027-fall", "2027-08-30"),
  };

  test("picks the newest season that has started", () => {
    expect(chooseCurrentSeason(seasons, "2026-10-18")).toBe("2026-fall");
    expect(chooseCurrentSeason(seasons, "2026-08-30")).toBe("2025-fall");
  });

  test("counts a season without a start date from Jan 1", () => {
    expect(chooseCurrentSeason({ "2026-spring": emptySeason("2026-spring") }, "2026-01-01")).toBe("2026-spring");
  });

  test("falls back to the earliest upcoming season", () => {
    expect(chooseCurrentSeason({ "2027-winter": emptySeason("2027-winter", "2027-11-15") }, today)).toBe("2027-winter");
    expect(chooseCurrentSeason({}, today)).toBeNull();
  });
});

describe("mergeGames", () => {
  test("keeps target order, appends new games, and respects prefer", () => {
    const target = [game("A", { comments: "target" }), game("B")];
    const incoming = [game("C"), game("A", { comments: "incoming" })];

    const keep = mergeGames(target, incoming, "target");
    expect(keep.games.map((g) => g.draftID)).toEqual(["A", "B", "C"]);
    expect(keep.games[0].comments).toBe("target");
    expect(keep.added).toBe(1);

    const replace = mergeGames(target, incoming, "incoming");
    expect(replace.games[0].comments).toBe("incoming");
  });

  test("matches games without a draft ID by content", () => {
    const loose = game("", { draftID: undefined });
    expect(mergeGames([loose], [structuredClone(loose)], "target").games).toHaveLength(1);
  });
});

describe("forwardMigrate", () => {
  const { teamFiles, summary, warnings } = migrate();
  const us = teamFiles["us-ultimate"];

  test("writes one file per team in teams.yaml", () => {
    expect(Object.keys(teamFiles).sort()).toEqual(["ms-ultimate", "msg-soccer", "us-ultimate"]);
    expect(us.schemaVersion).toBe(1);
    expect(us.teamID).toBe("us-ultimate");
  });

  test("names seasons <year>-<season> and labels them", () => {
    expect(Object.keys(us.seasons).sort()).toEqual(["2024-spring", "2025-spring", "2026-spring"]);
    expect(us.seasons["2026-spring"].label).toBe("2026 Spring");
  });

  test("keeps games in the exact Game.toJSON() shape", () => {
    const legacy = legacyRecords()["us-ultimate"]["2026"] as LegacySeason;
    expect(us.seasons["2026-spring"].games).toEqual(legacy.seasonRecordData ?? []);
  });

  test("migrates bare-array seasons", () => {
    expect(us.seasons["2024-spring"].games.map((g) => g.draftID)).toEqual(["G-2024-A", "G-2024-B"]);
    expect(us.seasons["2024-spring"].seasonRecordDraftID).toBeNull();
  });

  test("carries the season record draft ID verbatim", () => {
    expect(us.seasons["2026-spring"].seasonRecordDraftID).toBe("REC-2026");
    expect(teamFiles["msg-soccer"].seasons["2025-fall"].seasonRecordDraftID).toBe("");
  });

  test("moves practice plans into their season as W<n>", () => {
    expect(us.seasons["2026-spring"].practicePlans).toEqual({ W7: "PP-26-7" });
    expect(us.seasons["2024-spring"].practicePlans).toEqual({ W10: "PP-24-10" });
  });

  test("takes the start date from teams.yaml for that year only", () => {
    expect(us.seasons["2026-spring"].startDate).toBe("2026-03-02");
    expect(us.seasons["2025-spring"].startDate).toBeNull();
  });

  test("creates the teams.yaml season even with no games", () => {
    const ms = teamFiles["ms-ultimate"];
    expect(Object.keys(ms.seasons)).toEqual(["2025-spring"]);
    expect(ms.seasons["2025-spring"].games).toEqual([]);
  });

  test("sets currentSeason to the newest started season", () => {
    expect(us.currentSeason).toBe("2026-spring");
    expect(teamFiles["msg-soccer"].currentSeason).toBe("2026-fall");
    expect(teamFiles["ms-ultimate"].currentSeason).toBe("2025-spring");
  });

  test("summarizes counts per team and season", () => {
    const row = summary.find((s) => s.teamID == "msg-soccer" && s.seasonID == "2026-fall");
    expect(row).toEqual({
      teamID: "msg-soccer",
      seasonID: "2026-fall",
      games: 1,
      gamesAdded: 1,
      practicePlans: 2,
      plansAdded: 2,
    });
  });

  test("warns about teams it does not know, and ignores non-team keys", () => {
    expect(warnings).toEqual(["old-team: in records.json but not in teams.yaml, so not migrated"]);
  });

  test("never mutates its inputs", () => {
    const records = legacyRecords();
    const plans = legacyPlans();
    const existing = migrate().teamFiles;
    const before = JSON.stringify([records, plans, existing]);
    forwardMigrate({ records, practicePlans: plans, teams, existing, today });
    expect(JSON.stringify([records, plans, existing])).toBe(before);
  });
});

describe("forwardMigrate re-runs", () => {
  test("is idempotent", () => {
    const first = migrate().teamFiles;
    const second = migrate(first);
    expect(second.teamFiles).toEqual(first);
    expect(second.summary.every((s) => s.gamesAdded == 0 && s.plansAdded == 0)).toBe(true);
  });

  test("keeps games that exist only in the team file", () => {
    const first = migrate().teamFiles;
    first["msg-soccer"].seasons["2026-fall"].games.push(game("NEW-ON-BRANCH"));
    const second = migrate(first).teamFiles;
    expect(second["msg-soccer"].seasons["2026-fall"].games.map((g) => g.draftID)).toEqual(["S-2026-A", "NEW-ON-BRANCH"]);
  });

  test("adds games recorded on main after the first run", () => {
    const first = migrate().teamFiles;
    const records = legacyRecords();
    (records["msg-soccer"]["2026"] as { seasonRecordData: Game[] }).seasonRecordData.push(game("NEW-ON-MAIN"));
    const second = forwardMigrate({ records, practicePlans: legacyPlans(), teams, existing: first, today });
    const ids = second.teamFiles["msg-soccer"].seasons["2026-fall"].games.map((g) => g.draftID);
    expect(ids).toEqual(["S-2026-A", "NEW-ON-MAIN"]);
    expect(second.summary.find((s) => s.seasonID == "2026-fall")?.gamesAdded).toBe(1);
  });

  test("the team file wins when both sides hold the same game", () => {
    const first = migrate().teamFiles;
    first["msg-soccer"].seasons["2026-fall"].games[0].submitted = true;
    const second = migrate(first).teamFiles;
    expect(second["msg-soccer"].seasons["2026-fall"].games[0].submitted).toBe(true);
  });

  test("keeps an explicitly chosen current season", () => {
    const first = migrate().teamFiles;
    first["us-ultimate"].seasons["2026-winter"] = emptySeason("2026-winter", "2026-11-16");
    first["us-ultimate"].currentSeason = "2026-winter";
    expect(migrate(first).teamFiles["us-ultimate"].currentSeason).toBe("2026-winter");
  });
});

// The old files as the old code would see them after its own migration:
// bare arrays become the object form with no season record draft.
function normalizedLegacy(teamIDs: string[]) {
  const records = legacyRecords();
  const out: LegacyRecords = {};
  for (const teamID of teamIDs) {
    out[teamID] = {};
    for (const [year, season] of Object.entries(records[teamID] ?? {})) {
      out[teamID][year] = Array.isArray(season) ? { seasonRecordDraftID: null, seasonRecordData: season } : season;
    }
  }
  return out;
}

describe("reverseMigrate", () => {
  test("rebuilds the old files losslessly from team files alone", () => {
    const { teamFiles } = migrate();
    const { records, practicePlans } = reverseMigrate({ teamFiles });
    const expected = normalizedLegacy(["us-ultimate", "msg-soccer"]);

    for (const teamID of ["us-ultimate", "msg-soccer"]) {
      for (const [year, season] of Object.entries(expected[teamID])) {
        expect(records[teamID][year]).toEqual(season);
      }
    }
    expect(practicePlans["us-ultimate"]).toEqual(legacyPlans()["us-ultimate"]);
    expect(practicePlans["msg-soccer"]).toEqual(legacyPlans()["msg-soccer"]);
  });

  test("laid over the current files, keeps what team files do not cover", () => {
    const { teamFiles } = migrate();
    const { records, practicePlans } = reverseMigrate({
      teamFiles,
      records: legacyRecords(),
      practicePlans: legacyPlans(),
    });
    expect(records["old-team"]).toEqual(legacyRecords()["old-team"]);
    expect(practicePlans.practicePlanFile).toBe("not-a-team.md");
    expect(records["us-ultimate"]["2024"]).toEqual(normalizedLegacy(["us-ultimate"])["us-ultimate"]["2024"]);
  });

  test("puts games recorded only in the team file where main looks", () => {
    const { teamFiles } = migrate();
    teamFiles["msg-soccer"].seasons["2026-fall"].games.push(game("NEW-ON-BRANCH"));
    teamFiles["msg-soccer"].seasons["2026-fall"].practicePlans.W8 = "SPP-26-8";
    const { records, practicePlans, summary } = reverseMigrate({
      teamFiles,
      records: legacyRecords(),
      practicePlans: legacyPlans(),
    });
    const season = records["msg-soccer"]["2026"] as { seasonRecordData: Game[] };
    expect(season.seasonRecordData.map((g) => g.draftID)).toEqual(["S-2026-A", "NEW-ON-BRANCH"]);
    expect((practicePlans["msg-soccer"] as Record<string, string>)["2026W8"]).toBe("SPP-26-8");
    expect(summary.find((s) => s.seasonID == "2026-fall")).toMatchObject({ gamesAdded: 1, plansAdded: 1 });
  });

  test("does not write an empty plan map for a team without plans", () => {
    const { teamFiles } = migrate();
    expect(reverseMigrate({ teamFiles }).practicePlans["ms-ultimate"]).toBeUndefined();
  });

  test("files a winter season under the year it starts", () => {
    const teamFiles: TeamFiles = {
      "us-basketball": {
        schemaVersion: 1,
        teamID: "us-basketball",
        currentSeason: "2026-27",
        seasons: {
          "2026-27": { ...emptySeason("2026-27", "2026-11-16"), games: [game("B-1")], practicePlans: { W1: "BPP-1" } },
          winter: emptySeason("winter"),
        },
      },
    };
    const { records, practicePlans, warnings } = reverseMigrate({ teamFiles });
    expect((records["us-basketball"]["2026"] as { seasonRecordData: Game[] }).seasonRecordData).toHaveLength(1);
    expect(practicePlans["us-basketball"]).toEqual({ "2026W1": "BPP-1" });
    expect(warnings).toEqual(['us-basketball: season "winter" has no leading year, so the old code cannot see it']);
  });
});

describe("verifyMigration", () => {
  test("is clean right after a forward run, except for unmigrated teams", () => {
    const { teamFiles } = migrate();
    const rows = verifyMigration({ records: legacyRecords(), practicePlans: legacyPlans(), teamFiles });
    const dirty = rows.filter((row) => !isClean(row));
    expect(dirty.map((row) => `${row.teamID}/${row.year}`)).toEqual(["old-team/2024"]);
    expect(dirty[0].missingGames).toEqual(["O-2024-A"]);
  });

  test("reports missing, changed, and team-file-only games by draft ID", () => {
    const { teamFiles } = migrate();
    const season = teamFiles["us-ultimate"].seasons["2026-spring"];
    season.games = [game("G-2026-A", { comments: "edited" }), game("NEW-ON-BRANCH")];
    delete season.practicePlans.W7;

    const row = verifyMigration({ records: legacyRecords(), practicePlans: legacyPlans(), teamFiles })
      .find((r) => r.teamID == "us-ultimate" && r.year == "2026");
    expect(row).toMatchObject({
      legacyGames: 2,
      missingGames: ["G-2026-B"],
      changedGames: ["G-2026-A"],
      teamFileOnlyGames: 1,
      missingPlans: ["2026W7"],
    });
  });
});
