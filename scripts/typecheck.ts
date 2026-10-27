#!/usr/bin/env bun
/**
 * Type-check the Drafts scripts with the TypeScript compiler API.
 *
 * Plain `tsc` cannot model how Drafts loads these files, for two reasons:
 *
 * 1. TypeScript marks any .js file that contains a `require("x")` call (or a
 *    `module.exports` assignment) as a CommonJS module. A module's top-level
 *    classes are not globals, so a class declared in one file is invisible to
 *    every other file. In Drafts, `require()` evaluates the file into the one
 *    shared global scope, so the classes ARE globals. No compiler option turns
 *    this detection off (moduleDetection, module: none/preserve were all tried).
 *
 *    Fix: the files are read through a compiler host that rewrites, in memory
 *    only, `require(` to `Require(` and `module.exports` to `module.Exports`.
 *    Both rewrites keep the same length, so every reported line and column
 *    matches the file on disk. `Require` is declared in types/checker-shim.d.ts.
 *
 * 2. Each action run gets a fresh JavaScript context, so actions and tests
 *    reuse top-level names (`const ui`, `const cp`, ...) freely. Checked as one
 *    program, those are hundreds of false "Cannot redeclare" errors.
 *
 *    Fix: library files (Library/Scripts, test fixtures) are checked together
 *    in one program. Each entry point (Library/Actions/**, *-test.js) is checked
 *    in its own program holding only that file plus what it transitively
 *    require()s, the same set of files Drafts would load for it.
 *
 * 3. Require check. Library files are checked together, where every class is
 *    visible, so a missing require() in one never shows there. For each action,
 *    the "Cannot find name" errors (TS2304, TS2552) in the library files of its
 *    program are reported too, once per file and position, naming the first
 *    action by path that hit it. The action is kept out of the baseline key.
 *    Limit: a class counts as loaded when any file in the chain requires it,
 *    even inside a method that has not run yet, so load order is not checked.
 *
 * Compiler options and the file list come from tsconfig.json, so editors see
 * the same settings (minus fixes 1 and 2 above). The Bun tooling in scripts/
 * is checked as well, under scripts/tsconfig.json.
 *
 * Known errors that predate type checking are recorded in
 * scripts/typecheck-baseline.json and explained in
 * docs/reference/typecheck-findings.md. Only errors not in the baseline fail.
 *
 * Usage:
 *   bun run typecheck                      # fail on errors not in the baseline
 *   bun run typecheck --all                # report every error, ignore the baseline
 *   bun run typecheck --update-baseline    # rewrite the baseline from current errors
 */
import ts from "typescript";
import { existsSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const scriptsDir = join(root, "Library", "Scripts");
const actionsDir = join(root, "Library", "Actions");
const vendorDir = join(scriptsDir, "vendor");

function readConfig(path: string): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(path, undefined, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    },
  });
  if (!parsed) throw new Error(`Could not read ${path}`);
  return parsed;
}

const config = readConfig(join(root, "tsconfig.json"));

const options = config.options;
const typeFiles = config.fileNames.filter((file) => file.endsWith(".d.ts"));
const sourceFiles = config.fileNames.filter((file) => !file.endsWith(".d.ts"));

const isEntry = (file: string) => file.startsWith(`${actionsDir}/`) || file.endsWith("-test.js");
const entries = sourceFiles.filter(isEntry);
const libraries = sourceFiles.filter((file) => !isEntry(file));

// Vendor files are excluded from checking but still loaded as context, so
// globals they define (CryptoJS, ...) resolve for the files that use them.
const vendorFiles = [...new Bun.Glob("**/*.js").scanSync({ cwd: vendorDir, absolute: true })];

// Same-length rewrites; see the header comment.
const rewrite = (text: string) =>
  text.replace(/\brequire(\s*\()/g, "Require$1").replace(/\bmodule\.exports\b/g, "module.Exports");

const isProjectScript = (file: string) => file.endsWith(".js") && file.startsWith(`${root}/Library/`);

// Parse each file once and share it across every program.
const parsed = new Map<string, ts.SourceFile>();
const host = ts.createCompilerHost(options);
const defaultGetSourceFile = host.getSourceFile;
host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
  const cached = parsed.get(fileName);
  if (cached) return cached;
  const sourceFile = isProjectScript(fileName)
    ? ts.createSourceFile(fileName, rewrite(ts.sys.readFile(fileName) ?? ""), languageVersion, true)
    : defaultGetSourceFile(fileName, languageVersion, onError, shouldCreate);
  sourceFile && parsed.set(fileName, sourceFile);
  return sourceFile;
};

// Resolve Drafts-style require paths the same way scripts/test-runner.js does:
// relative to Library/Scripts/, falling back to the requiring file's folder.
function requiresOf(file: string): string[] {
  const text = ts.sys.readFile(file) ?? "";
  const found: string[] = [];
  for (const match of text.matchAll(/\brequire\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    const candidates = [join(scriptsDir, match[1]), join(dirname(file), match[1])];
    const target = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
    target && found.push(resolve(target));
  }
  return found;
}

function loadedBy(entry: string): string[] {
  const seen = new Set<string>([entry]);
  const pending = [entry];
  while (pending.length > 0) {
    for (const target of requiresOf(pending.pop()!)) {
      if (seen.has(target)) continue;
      seen.add(target);
      pending.push(target);
    }
  }
  return [...seen];
}

const fileDiagnostics = (program: ts.Program, file: string) => {
  const sourceFile = program.getSourceFile(file);
  return sourceFile
    ? [...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile)]
    : [];
};

const diagnostics: ts.Diagnostic[] = [...ts.getConfigFileParsingDiagnostics(config)];

const libraryProgram = ts.createProgram([...typeFiles, ...vendorFiles, ...libraries], options, host);
diagnostics.push(...libraryProgram.getOptionsDiagnostics(), ...libraryProgram.getGlobalDiagnostics());
for (const file of [...typeFiles, ...libraries]) diagnostics.push(...fileDiagnostics(libraryProgram, file));

// Require check: "Cannot find name" (and its "Did you mean" form) in a library
// file means a class or function that file uses is not loaded by this action.
const nameNotFound = new Set([2304, 2552]);
const isAction = (file: string) => file.startsWith(`${actionsDir}/`) && !file.endsWith("-test.js");
const isLibraryFile = (file: string) => file.startsWith(`${scriptsDir}/`) && !file.startsWith(`${vendorDir}/`);

// One name-not-found error per file and position, however many actions hit it,
// so it counts once against the baseline. The library program's own errors are
// seeded first and so are never counted twice.
const positionOf = (diagnostic: ts.Diagnostic) => `${diagnostic.file!.fileName}:${diagnostic.start}`;
const seenNotFound = new Set(diagnostics.filter((d) => d.file && nameNotFound.has(d.code)).map(positionOf));

// The action that exposed each require-check error. Shown in the output only,
// never part of the baseline key. Actions run in sorted order, so it is the
// first such action by path.
const loadedVia = new Map<ts.Diagnostic, string>();

function requireCheck(program: ts.Program, action: string) {
  for (const file of program.getRootFileNames().filter(isLibraryFile)) {
    for (const diagnostic of fileDiagnostics(program, file)) {
      if (!nameNotFound.has(diagnostic.code) || seenNotFound.has(positionOf(diagnostic))) continue;
      seenNotFound.add(positionOf(diagnostic));
      loadedVia.set(diagnostic, relative(root, action));
      diagnostics.push(diagnostic);
    }
  }
}

for (const entry of entries.toSorted()) {
  const program = ts.createProgram([...typeFiles, ...loadedBy(entry)], options, host);
  diagnostics.push(...fileDiagnostics(program, entry));
  isAction(entry) && requireCheck(program, entry);
}

// The Bun tooling in scripts/ is TypeScript with its own strict config. It is
// checked with plain tsc semantics and is never baselined.
const toolingConfig = readConfig(join(import.meta.dir, "tsconfig.json"));
const toolingDiagnostics = [
  ...ts.getConfigFileParsingDiagnostics(toolingConfig),
  ...ts.getPreEmitDiagnostics(ts.createProgram(toolingConfig.fileNames, toolingConfig.options)),
];

// Baseline: known errors that predate type checking. Each one is explained in
// docs/reference/typecheck-findings.md. An entry matches on file, error code,
// message, and the trimmed text of the source line, so edits elsewhere in a
// file do not invalidate it, but editing the offending line does. New errors
// always fail the run.
type BaselineEntry = { file: string; code: number; message: string; line: string; count: number };

const baselinePath = join(import.meta.dir, "typecheck-baseline.json");
const args = new Set(process.argv.slice(2));

const describe = (diagnostic: ts.Diagnostic) => {
  const file = diagnostic.file!;
  const { line } = file.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
  return {
    file: relative(root, file.fileName),
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " "),
    line: (ts.sys.readFile(file.fileName) ?? "").split("\n")[line]?.trim() ?? "",
  };
};
const keyOf = (entry: Omit<BaselineEntry, "count">) =>
  JSON.stringify([entry.file, entry.code, entry.message, entry.line]);

if (args.has("--update-baseline")) {
  const counts = new Map<string, BaselineEntry>();
  for (const diagnostic of diagnostics.filter((d) => d.file)) {
    const entry = describe(diagnostic);
    const existing = counts.get(keyOf(entry));
    existing ? existing.count++ : counts.set(keyOf(entry), { ...entry, count: 1 });
  }
  const entries = [...counts.values()].sort((a, b) => a.file.localeCompare(b.file) || a.code - b.code);
  await Bun.write(baselinePath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`Wrote ${entries.length} entries (${diagnostics.length} errors) to ${relative(root, baselinePath)}`);
  process.exit(0);
}

const remaining = new Map<string, number>();
if (!args.has("--all") && existsSync(baselinePath)) {
  for (const entry of JSON.parse(ts.sys.readFile(baselinePath)!) as BaselineEntry[]) {
    remaining.set(keyOf(entry), (remaining.get(keyOf(entry)) ?? 0) + entry.count);
  }
}

const reported = diagnostics.filter((diagnostic) => {
  if (!diagnostic.file) return true;
  const key = keyOf(describe(diagnostic));
  const left = remaining.get(key) ?? 0;
  if (left == 0) return true;
  remaining.set(key, left - 1);
  return false;
});
const baselined = diagnostics.length - reported.length;
reported.push(...toolingDiagnostics);
const stale = [...remaining.values()].reduce((sum, count) => sum + count, 0);

const formatHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: (file) => file,
  getCurrentDirectory: () => root,
  getNewLine: () => "\n",
};
const format = process.stdout.isTTY ? ts.formatDiagnosticsWithColorAndContext : ts.formatDiagnostics;

// Name the action on require-check errors, after baseline matching.
const withAction = (diagnostic: ts.Diagnostic): ts.Diagnostic => {
  const action = loadedVia.get(diagnostic);
  if (action == undefined) return diagnostic;
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
  return { ...diagnostic, messageText: `${message} (loaded by ${action})` };
};
reported.length > 0 && console.log(format(reported.map(withAction), formatHost));

console.log(
  `Checked ${libraries.length} library files, ${entries.length} entry points, and ` +
    `${toolingConfig.fileNames.length} tooling scripts: ` +
    `${reported.length} error(s) not in the baseline, ${baselined} baselined.`,
);
stale > 0 &&
  console.log(
    `${stale} baselined error(s) no longer occur. Run \`bun run typecheck --update-baseline\` ` +
      "and update docs/reference/typecheck-findings.md.",
  );
process.exit(reported.length > 0 ? 1 : 0);
