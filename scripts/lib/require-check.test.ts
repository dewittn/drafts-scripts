/**
 * Require check for the Drafts scripts.
 *
 * Drafts loads a class only when some file require()s it, and the unit tests'
 * global stubs can hide a missing require. This scans Library/Scripts/**\/*.js
 * (minus vendor/ and the legacy Airtable files) and reports any project class
 * a file uses (`new X(`, `X.something`, `extends X`) that another file defines,
 * when the using file never requires that file. A require anywhere in the file
 * counts, top-level or inside a `typeof` guard. Comments and strings are
 * ignored. Known gaps are listed in `allowlist`, one per line, so a new gap
 * fails here and a fixed one has to be removed from the list.
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./drafts-paths";

// Pre-existing gaps: "<file relative to Library/Scripts> <Class>".
const allowlist = [
  "modules/bvr/core/Game.js GoogleForm",
  "modules/bvr/core/Sport.js Settings",
  "modules/bvr/core/Team.js PracticePlan",
  "modules/bvr/core/Team.js TeamConfig",
  "shared/libraries/nocodb.js Settings",
];

const scriptsDir = join(repoRoot, "Library", "Scripts");
const skipped = (path: string) => path.startsWith("vendor/") || path.startsWith("bvr/tests/") || /airtable/i.test(path);
const files = [...new Bun.Glob("**/*.js").scanSync({ cwd: scriptsDir })].filter((path) => !skipped(path)).sort();

// Where a "..." or '...' string, or a /regex/, that starts at i ends.
function literalEnd(source: string, i: number): number {
  const quote = source[i];
  let inClass = false;
  for (let j = i + 1; j < source.length; j++) {
    const char = source[j];
    if (char == "\\") j++;
    else if (char == "\n") return j;
    else if (quote == "/" && (char == "[" || char == "]")) inClass = char == "[";
    else if (char == quote && !inClass) return j + 1;
  }
  return source.length;
}

// Where a `template` that starts at i ends, and the code in its ${...} parts.
function templateEnd(source: string, i: number): { end: number; expressions: string[] } {
  const expressions: string[] = [];
  let j = i + 1;
  while (j < source.length) {
    if (source[j] == "\\") j += 2;
    else if (source[j] == "`") return { end: j + 1, expressions };
    else if (source[j] == "$" && source[j + 1] == "{") {
      let depth = 1;
      let k = j + 2;
      for (; k < source.length && depth > 0; k++) depth += source[k] == "{" ? 1 : source[k] == "}" ? -1 : 0;
      expressions.push(source.slice(j + 2, k - 1));
      j = k;
    } else j++;
  }
  return { end: source.length, expressions };
}

// A "/" starts a regex when the code before it cannot end an expression.
const startsRegex = (before: string) => {
  const code = before.trimEnd();
  return code == "" || /[(,=:[!&|?{};+\-*%<>~^]$/.test(code) || /\breturn$/.test(code);
};

// The source with comments removed and, unless keepStrings, string, template,
// and regex literals emptied. Code inside a template's ${...} is kept.
function stripSource(source: string, { keepStrings = false } = {}): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char == "/" && next == "/") {
      const end = source.indexOf("\n", i);
      i = end == -1 ? source.length : end;
    } else if (char == "/" && next == "*") {
      const end = source.indexOf("*/", i + 2);
      i = end == -1 ? source.length : end + 2;
      out += " ";
    } else if (char == "`") {
      const { end, expressions } = templateEnd(source, i);
      out += keepStrings ? source.slice(i, end) : `\`\` ${expressions.map((code) => stripSource(code)).join(" ")} `;
      i = end;
    } else if (char == '"' || char == "'" || (char == "/" && startsRegex(out))) {
      const end = literalEnd(source, i);
      out += keepStrings && char != "/" ? source.slice(i, end) : `${char}${char}`;
      i = end;
    } else {
      out += char;
      i++;
    }
  }
  return out;
}

const code = new Map(files.map((path) => [path, readFileSync(join(scriptsDir, path), "utf8")]));

// Class name -> the files that define it (a few classes exist in two files).
const definedIn = new Map<string, string[]>();
for (const [path, source] of code) {
  for (const [, name] of stripSource(source).matchAll(/^class\s+([A-Z]\w*)/gm)) {
    definedIn.set(name, [...(definedIn.get(name) ?? []), path]);
  }
}

// The files a file requires, as paths relative to Library/Scripts.
const requiresOf = (source: string) =>
  new Set([...stripSource(source, { keepStrings: true }).matchAll(/\brequire\(\s*["'`]([^"'`]+)["'`]\s*\)/g)].map(([, path]) => path));

// "<file> <Class>" for each class used without requiring a file that defines it.
function findGaps(): string[] {
  const gaps: string[] = [];
  for (const [path, source] of code) {
    const stripped = stripSource(source);
    const required = requiresOf(source);
    for (const [name, definers] of definedIn) {
      if (definers.includes(path)) continue;
      const used = new RegExp(`(?<![\\w.$#])(?:new\\s+${name}\\s*\\(|extends\\s+${name}\\b|${name}\\s*\\.)`).test(stripped);
      if (used && !definers.some((definer) => required.has(definer))) gaps.push(`${path} ${name}`);
    }
  }
  return gaps.sort();
}

const gaps = findGaps();

test("every project class a file uses is required in that file", () => {
  const newGaps = gaps.filter((gap) => !allowlist.includes(gap));
  expect(newGaps).toEqual([]);
});

test("the allowlist holds only gaps that still exist", () => {
  const fixed = allowlist.filter((entry) => !gaps.includes(entry));
  expect(fixed).toEqual([]);
});

test("the scanner sees what it should", () => {
  expect(files).toContain("modules/bvr/core/Season.js");
  expect(files.some((path) => path.startsWith("vendor/") || /airtable/i.test(path))).toBe(false);
  expect(definedIn.get("Season")).toEqual(["modules/bvr/core/Season.js"]);
  expect(stripSource('const a = "new Team(";\n// new Team(\nnew Game(x);')).not.toContain("Team");
  expect(stripSource("const r = /'/; new Game(x);")).toContain("new Game(");
  expect(stripSource("const t = `${TeamFileStore.seasonLabel(id)} season`;")).toContain("TeamFileStore.seasonLabel");
  expect(requiresOf('if (typeof X == "undefined") require("modules/x/X.js"); // require("y.js")')).toEqual(new Set(["modules/x/X.js"]));
});
