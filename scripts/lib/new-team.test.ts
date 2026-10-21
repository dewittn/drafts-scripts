/**
 * Tests for the pure parts of `bun run new-team`. All teams are synthetic
 * except where the committed teams.yaml is used to check the rendering.
 */
import { describe, expect, test } from "bun:test";
import yaml from "js-yaml";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./drafts-paths";
import {
  appendEntry,
  chooseFromTeam,
  newTeamProblems,
  renderSportEntry,
  renderTeamEntry,
  substitute,
  substitutionsFor,
  yamlScalar,
  type ExistingTeam,
  type NewTeamOptions,
} from "./new-team";

const basketball: NewTeamOptions = {
  id: "msg-basketball",
  name: "MS Girls Basketball",
  abbr: "MSGB",
  sport: "basketball",
  level: "ms",
  season: "winter",
  start: "2026-10-30",
};

const soccer: ExistingTeam = {
  id: "msg-soccer",
  name: "MS Girls Soccer",
  abbr: "MSGS",
  sport: "soccer",
  level: "ms",
  defaultTag: "bvr/soccer/ms",
  practicePlan: { draftTags: ["bvr/soccer/msg/practice/plan"] },
};
const ultimate: ExistingTeam = { id: "us-ultimate", name: "Varsity Ultimate Frisbee", abbr: "VUF", sport: "ultimate", level: "us" };
const msUltimate: ExistingTeam = { id: "ms-ultimate", name: "MS Ultimate Frisbee", abbr: "MSUF", sport: "ultimate", level: "ms" };

describe("newTeamProblems", () => {
  test("accepts a complete set of options", () => {
    expect(newTeamProblems(basketball, [soccer], ["ms", "us"])).toEqual([]);
  });

  test("names every missing flag", () => {
    expect(newTeamProblems({ id: "x" }, [], ["ms"])).toEqual([
      "--name is required",
      "--abbr is required",
      "--sport is required",
      "--level is required",
      "--season is required",
      "--start is required",
    ]);
  });

  test("refuses an existing or unsafe id, and bad values", () => {
    const problems = newTeamProblems(
      { ...basketball, id: "msg-soccer", abbr: "msgb", level: "hs", season: "Winter Term", start: "2026-02-30" },
      [soccer],
      ["ms", "us"],
    );
    expect(problems).toEqual([
      "msg-soccer is already in teams.yaml",
      '--abbr must be capital letters and digits, got "msgb"',
      '--level must be one of ms, us, got "hs"',
      '--season must be one lowercase word (fall, winter, spring), got "Winter Term"',
      '--start must be a date as YYYY-MM-DD, got "2026-02-30"',
    ]);
    expect(newTeamProblems({ ...basketball, id: "../teams" }, [], ["ms"])[0]).toContain("not a safe file name");
  });
});

describe("chooseFromTeam", () => {
  test("takes the newest team at the same level", () => {
    expect(chooseFromTeam([ultimate, msUltimate, soccer], "ms", "basketball")?.id).toBe("msg-soccer");
  });

  test("falls back to the newest team in the sport", () => {
    expect(chooseFromTeam([ultimate, msUltimate], "hs", "ultimate")?.id).toBe("ms-ultimate");
    expect(chooseFromTeam([ultimate], "hs", "basketball")).toBeUndefined();
  });
});

describe("rendering", () => {
  test("quotes only what needs it", () => {
    expect(yamlScalar("MS Girls Basketball")).toBe("MS Girls Basketball");
    expect(yamlScalar("Boys: Varsity")).toBe('"Boys: Varsity"');
    expect(yamlScalar("2026-10-30", { quote: true })).toBe('"2026-10-30"');
  });

  test("reproduces the committed msg-basketball entry", () => {
    const text = readFileSync(join(repoRoot, "Library/Data/bvr/teams.yaml"), "utf8");
    const committed = (yaml.load(text) as { teamsData: Record<string, unknown>[] }).teamsData.find((t) => t.id == "msg-basketball");
    const rendered = (yaml.load(renderTeamEntry(basketball).replace(/^  /gm, "")) as Record<string, unknown>[])[0];
    expect(rendered).toEqual(committed!);
    expect(Object.keys(rendered)).toEqual(Object.keys(committed!));
  });

  test("calendar defaults to the abbr", () => {
    expect(renderTeamEntry(basketball)).toContain("    calendar: MSGB\n");
    expect(renderTeamEntry({ ...basketball, calendar: "Hoops" })).toContain("    calendar: Hoops\n");
  });

  test("sports entries use the file's block style", () => {
    expect(renderSportEntry("basketball", { maxScore: 50, selectedValue: 10 })).toBe(
      "basketball:\n  maxScore: 50\n  selectedValue: 10\n",
    );
  });

  test("appending keeps the text before it", () => {
    expect(appendEntry("# header\na: 1", "b: 2\n")).toBe("# header\na: 1\nb: 2\n");
    expect(appendEntry("a: 1\n", "b: 2\n")).toBe("a: 1\nb: 2\n");
  });
});

describe("substitution", () => {
  test("swaps the old team's name, id, abbr, and tags", () => {
    const pairs = substitutionsFor(soccer, basketball);
    const source = "# MS Girls Soccer\n[[MSGS: Roster 2026]]\nmsg-soccer bvr/soccer/ms bvr/soccer/msg/practice/plan soccer balls";
    const { text, replaced } = substitute(source, pairs);
    expect(text).toBe(
      "# MS Girls Basketball\n[[MSGB: Roster 2026]]\nmsg-basketball bvr/basketball/ms bvr/basketball/practice/plan soccer balls",
    );
    expect(replaced.map((r) => [r.from, r.count])).toEqual([
      ["bvr/soccer/msg/practice/plan", 1],
      ["MS Girls Soccer", 1],
      ["bvr/soccer/ms", 1],
      ["msg-soccer", 1],
      ["MSGS", 1],
    ]);
  });

  test("reports nothing when nothing matches", () => {
    expect(substitute("plain", substitutionsFor(soccer, basketball)).replaced).toEqual([]);
  });
});
