/**
 * Bundles a community action script into one self-contained file. Shared
 * actions can't require() files from this repo, so each
 * `require("<path>")` line is replaced with that file's contents, read from
 * Library/Scripts/ like Drafts does. A file is inlined once, even when
 * several files require it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const requireLine = /^\s*require\(\s*["']([^"']+)["']\s*\);?\s*$/;

// The source with every require() line replaced by the file it names.
export function bundle(source: string, scriptsDir: string, seen = new Set<string>()): string {
  return source
    .split("\n")
    .map((line) => {
      const path = line.match(requireLine)?.[1];
      if (!path) return line;
      if (seen.has(path)) return `// ${path} is included above`;
      seen.add(path);
      const contents = readFileSync(join(scriptsDir, path), "utf8").trimEnd();
      return `// --- ${path} ---\n${bundle(contents, scriptsDir, seen)}\n// --- end ${path} ---`;
    })
    .join("\n");
}
