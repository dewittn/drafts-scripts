#!/usr/bin/env bun
/**
 * Vendor the official Drafts type definitions into types/drafts.d.ts and
 * re-apply the project's patches.
 *
 * Two patches are applied, both idempotent:
 *
 * 1. Remove the official `declare class Airtable`. Drafts ships a
 *    built-in Airtable class, but this project defines its own global
 *    `class Airtable` in Library/Scripts/shared/libraries/airtable-v2.js, which
 *    shadows the built-in at runtime. Two global class declarations with the
 *    same name are a type error, so the official one is cut out and replaced
 *    with a marker comment.
 *
 * 2. Rewrite one-element tuple types such as `[string]` to arrays (`string[]`).
 *    Upstream uses the tuple form for arrays like `Draft.lines`, so indexing
 *    past element 0 is reported as an error.
 *
 * Usage:
 *   bun scripts/update-drafts-types.ts              # download upstream main
 *   bun scripts/update-drafts-types.ts path/to.d.ts # patch a local copy
 */
import { join, resolve } from "node:path";

const REPO = "agiletortoise/drafts-script-reference";
const FILE = "src/drafts.d.ts";
const MARKER = "PATCHED(drafts-scripts): official `declare class Airtable` removed";

const root = resolve(import.meta.dir, "..");
const outPath = join(root, "types", "drafts.d.ts");

async function upstreamCommit(): Promise<{ sha: string; date: string }> {
  try {
    const url = `https://api.github.com/repos/${REPO}/commits?path=${FILE}&per_page=1`;
    const response = await fetch(url);
    const [latest] = (await response.json()) as Array<{ sha: string; commit: { committer: { date: string } } }>;
    return { sha: latest.sha, date: latest.commit.committer.date };
  } catch {
    return { sha: "unknown", date: "unknown" };
  }
}

async function loadSource(localPath?: string): Promise<{ text: string; origin: string }> {
  if (localPath) {
    return { text: await Bun.file(localPath).text(), origin: `local file ${localPath}` };
  }
  const { sha, date } = await upstreamCommit();
  const ref = sha == "unknown" ? "main" : sha;
  const response = await fetch(`https://raw.githubusercontent.com/${REPO}/${ref}/${FILE}`);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  return { text: await response.text(), origin: `${REPO} ${FILE} @ ${sha} (committed ${date})` };
}

// Cut the Airtable class declaration and the JSDoc block directly above it.
export function patchAirtable(source: string): string {
  if (source.includes(MARKER)) return source;

  const lines = source.split("\n");
  const start = lines.findIndex((line) => /^declare class Airtable\s*\{/.test(line));
  if (start == -1) throw new Error("declare class Airtable not found; upstream changed, review the patch");

  let docStart = start;
  if (lines[start - 1]?.trim() == "*/") {
    docStart = start - 1;
    while (docStart > 0 && !lines[docStart].trim().startsWith("/**")) docStart--;
  }

  const end = lines.findIndex((line, index) => index > start && line == "}");
  if (end == -1) throw new Error("End of declare class Airtable not found; review the patch");

  const replacement = [
    `// ${MARKER}.`,
    "// The project defines its own global class Airtable in",
    "// Library/Scripts/shared/libraries/airtable-v2.js, which shadows the Drafts built-in.",
    "// Re-apply with: bun scripts/update-drafts-types.ts",
  ];
  lines.splice(docStart, end - docStart + 1, ...replacement);
  return lines.join("\n");
}

// Upstream writes several array types as one-element tuples (`lines: [string]`),
// which makes `draft.lines[3]` a type error. Rewrite `[T]` to `T[]` in type
// positions only; comment lines are left alone.
export function patchTupleArrays(source: string): string {
  return source
    .split("\n")
    .map((line) =>
      /^\s*(\*|\/\*|\/\/)/.test(line) ? line : line.replace(/(:\s*)\[(\w+)\](?=[\s,)]|$)/g, "$1$2[]"),
    )
    .join("\n");
}

if (import.meta.main) {
  const { text, origin } = await loadSource(process.argv[2]);
  const header = [
    `// Vendored from ${origin}.`,
    `// Retrieved ${new Date().toISOString().slice(0, 10)}. Do not edit by hand; see types/README.md.`,
    "",
  ].join("\n");
  const body = patchTupleArrays(patchAirtable(text.replace(/^\/\/ Vendored from[^\n]*\n\/\/ Retrieved[^\n]*\n\n/, "")));
  await Bun.write(outPath, header + body);
  console.log(`Wrote ${outPath}`);
  console.log(`Source: ${origin}`);
}
