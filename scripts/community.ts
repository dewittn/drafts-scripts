#!/usr/bin/env bun
/**
 * Builds the shareable versions of actions for the Drafts community.
 *
 * Each `community/<name>/script.js` is written out as `community/<name>/<name>.js`
 * with its require() lines inlined (see scripts/lib/community.ts), ready to
 * paste into the action's Script step. Edit script.js and the module it
 * requires, never the built file.
 *
 * Usage: bun scripts/community.ts
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { bundle } from "./lib/community";

const root = resolve(import.meta.dir, "..");
const communityDir = join(root, "community");
const scriptsDir = join(root, "Library/Scripts");

for (const name of readdirSync(communityDir)) {
  const entry = join(communityDir, name, "script.js");
  if (!existsSync(entry)) continue;

  const header = `// ${name}.js is built from community/${name}/script.js by \`bun run community\`. Don't edit it by hand.\n\n`;
  const output = join(communityDir, name, `${name}.js`);
  writeFileSync(output, header + bundle(readFileSync(entry, "utf8"), scriptsDir).trimEnd() + "\n");
  console.log(`Built community/${name}/${name}.js`);
}
