#!/usr/bin/env bun
/**
 * Local test runner for Drafts scripts.
 *
 * Drafts runs every script in one shared global scope with a `require()` that
 * resolves paths relative to Library/Scripts/. This runner recreates that so
 * tests can run under Bun without the app. Each test file gets its own fresh
 * context so globals from one test cannot leak into another.
 *
 * It covers loading and plain logic. It cannot stand in for Drafts objects
 * (Draft, editor, app, Prompt, ...). The one stub provided is a read-only
 * FileManager backed by the local Library/ folder, since fixtures load data
 * through it. A test that touches any other Drafts global without stubbing
 * it is reported as "needs Drafts", not as a failure.
 *
 * Usage:
 *   bun run test                 # all unit tests
 *   bun run test query-letter    # only files whose path contains the filter
 *   bun run test --all           # unit + integration + top-level tests
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dir, "..");
const scriptsDir = join(root, "Library", "Scripts");
const testsDir = join(root, "Library", "Tests");

const args = process.argv.slice(2);
const runAll = args.includes("--all");
const filters = args.filter((arg) => !arg.startsWith("--"));

function findTests(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...findTests(full));
    } else if (entry.endsWith("-test.js")) {
      found.push(full);
    }
  }
  return found.sort();
}

function matchesFilter(file) {
  if (filters.length == 0) return true;
  return filters.some((filter) => file.includes(filter));
}

// Resolve a Drafts-style require path. Primary rule is relative to
// Library/Scripts/; fall back to the requiring file's directory so older
// tests written with true relative paths still load.
function resolveRequire(request, fromFile) {
  const candidates = [join(scriptsDir, request), join(dirname(fromFile), request)];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new Error(`require("${request}") not found from ${fromFile}`);
}

// Read-only stand-in for Drafts' FileManager, backed by the local Library/
// folder (the same files that sync to iCloud). Writes are refused so a test
// that depends on them is reported as needing Drafts rather than passing.
function createFileManagerStub() {
  const readString = (path) => {
    try {
      return readFileSync(join(root, path), "utf8");
    } catch {
      return undefined;
    }
  };
  const refuse = (method) => () => {
    throw new ReferenceError(`FileManager.${method} is not available outside Drafts`);
  };
  const instance = {
    readString,
    readJSON: (path) => {
      const content = readString(path);
      return content == undefined ? undefined : JSON.parse(content);
    },
    exists: (path) => readString(path) != undefined,
    writeString: refuse("writeString"),
    writeJSON: refuse("writeJSON"),
    lastError: undefined,
  };
  return { createCloud: () => instance, createLocal: () => instance, create: () => instance };
}

function runTest(file) {
  const logs = [];
  const sandboxConsole = {
    log: (...parts) => logs.push(parts.join(" ")),
    error: (...parts) => logs.push(parts.join(" ")),
    warn: (...parts) => logs.push(parts.join(" ")),
  };

  const context = vm.createContext({ console: sandboxConsole, FileManager: createFileManagerStub() });
  const loaded = new Set();
  const stack = [file];

  context.require = (request) => {
    const target = resolveRequire(request, stack[stack.length - 1]);
    if (loaded.has(target)) return true;
    loaded.add(target);
    stack.push(target);
    try {
      vm.runInContext(readFileSync(target, "utf8"), context, { filename: target });
    } finally {
      stack.pop();
    }
    return true;
  };

  try {
    vm.runInContext(readFileSync(file, "utf8"), context, { filename: file });
    return { status: "pass", logs };
  } catch (error) {
    const missingGlobal = /^(\w+) is not defined$/.exec(error.message);
    if (error instanceof ReferenceError || missingGlobal) {
      return { status: "needs-drafts", logs, detail: error.message };
    }
    return { status: "fail", logs, detail: error.message };
  }
}

const searchDirs = runAll ? [testsDir] : [join(testsDir, "unit")];
const files = searchDirs.flatMap(findTests).filter(matchesFilter);

if (files.length == 0) {
  console.log("No test files matched.");
  process.exit(1);
}

const results = { pass: [], fail: [], "needs-drafts": [] };
for (const file of files) {
  const relative = file.replace(`${root}/`, "");
  const result = runTest(file);
  results[result.status].push(relative);

  const icon = { pass: "✅", fail: "❌", "needs-drafts": "⏭️ " }[result.status];
  console.log(`${icon} ${relative}${result.detail ? ` — ${result.detail}` : ""}`);
  if (result.status == "fail") {
    console.log(result.logs.filter((line) => line.includes("❌")).map((line) => `     ${line}`).join("\n"));
  }
}

console.log("");
console.log(`Passed: ${results.pass.length}   Failed: ${results.fail.length}   Needs Drafts: ${results["needs-drafts"].length}`);
process.exit(results.fail.length > 0 ? 1 : 0);
