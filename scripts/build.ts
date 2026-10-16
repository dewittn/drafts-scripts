#!/usr/bin/env bun
/**
 * Build and sync pipeline for the Drafts scripts. Replaces gulpfile.js.
 *
 * Usage: bun scripts/build.ts <task> [--force]
 *
 *   sync       data, inject, yaml2json, push, in that order (also the default)
 *   watch      sync once, then rebuild on every change under Library/
 *   data       pull runtime .json files from iCloud into Library/
 *   inject     render each .tpl into its .yaml with `op inject`
 *              (skips a .tpl whose .yaml is up to date; --force renders all)
 *   yaml2json  convert every Library/Data/**\/*.yaml to .json
 *   push       mirror Library/ to iCloud with rsync --delete
 *   clean      delete the generated settings .yaml files
 *   debug      print the source and destination paths
 *
 * DRAFTS_DEST overrides the destination (the Drafts iCloud Documents folder).
 * Point it at a scratch directory to try the pipeline without touching iCloud.
 */
import yaml from "js-yaml";
import { existsSync, readFileSync, readdirSync, statSync, watch, writeFileSync } from "node:fs";
import { copyFile, mkdir, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "..");
const srcDir = join(root, "Library");
const dataDir = join(srcDir, "Data");
const excludeFile = join(root, "exclude-file.txt");
const defaultDest = join(homedir(), "Library", "Mobile Documents", "iCloud~com~agiletortoise~Drafts5", "Documents");
const destDir = process.env.DRAFTS_DEST ?? defaultDest;

const force = process.argv.includes("--force");

// Build artifacts: .yaml generated from .tpl by inject, .json generated from
// .yaml by yaml2json. The watcher ignores them so a rebuild's own writes do
// not retrigger it.
const generatedSettings = [
  "gameReportSettings.yaml",
  "settings.yaml",
  "attendanceSettings.yaml",
  "templateSettings.yaml",
];

const timestamp = () => new Date().toTimeString().slice(0, 8);
const log = (...parts: unknown[]) => console.log(`[${timestamp()}]`, ...parts);
const logError = (...parts: unknown[]) => console.error(`[${timestamp()}]`, ...parts);

// Run a command without a shell, so glob characters in arguments stay literal.
async function run(cmd: string[], options: { capture?: boolean } = {}): Promise<string> {
  const proc = Bun.spawn(cmd, {
    cwd: root,
    stdout: options.capture ? "pipe" : "inherit",
    stderr: options.capture ? "pipe" : "inherit",
  });
  const [stdout, stderr, code] = await Promise.all([
    options.capture ? new Response(proc.stdout).text() : "",
    options.capture ? new Response(proc.stderr).text() : "",
    proc.exited,
  ]);
  if (code != 0) {
    const detail = stderr.trim() ? `\n${stderr.trim()}` : "";
    throw new Error(`${cmd[0]} exited with code ${code}${detail}`);
  }
  return stdout;
}

function debug() {
  log("./Library/*");
  log(`${destDir}/`);
}

// Pull back only .json data (runtime state Drafts writes, such as records).
// The final --exclude=* keeps every other file type from overwriting local edits.
async function data() {
  await run([
    "rsync", "-r", "--progress",
    "--include=*/", "--include=*.json",
    `--exclude-from=${excludeFile}`, "--exclude=*",
    `${destDir}/Library/`, "Library",
  ]);
}

async function inject() {
  const templates = [...new Bun.Glob("**/*.tpl").scanSync({ cwd: srcDir, absolute: true })].sort();
  for (const tpl of templates) {
    const yamlPath = tpl.replace(/\.tpl$/, ".yaml");
    // Gulp stamped each .yaml with its .tpl's mtime, so equal counts as current.
    if (!force && existsSync(yamlPath) && statSync(yamlPath).mtimeMs >= statSync(tpl).mtimeMs) continue;

    let rendered: string;
    try {
      rendered = await run(["op", "inject", "-i", tpl], { capture: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const hint = /socket|desktop app|connect/i.test(message)
        ? "\nThe 1Password desktop app is probably not running, or the sandbox is on. Launch it and retry."
        : "";
      throw new Error(`op inject failed for ${relative(root, tpl)}: ${message}${hint}`);
    }
    await writeFile(yamlPath, rendered);
    log(`Injected: ${relative(root, tpl)} → ${relative(root, yamlPath)}`);
  }
}

// Same traversal and output as gulpfile.js: two-space JSON, no trailing
// newline. A file that fails to convert is logged and skipped, as before.
function yaml2json() {
  const convertFile = (filePath: string) => {
    try {
      const jsonData = yaml.load(readFileSync(filePath, "utf8"));
      const jsonFilePath = filePath.replace(/\.yaml$/, ".json");
      writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));
      log(`Converted: ${relative(root, filePath)} → ${relative(root, jsonFilePath)}`);
    } catch (error) {
      logError(`Error converting ${relative(root, filePath)}: ${(error as Error).message}`);
    }
  };

  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch (error) {
      (error as NodeJS.ErrnoException).code != "ENOENT" &&
        logError(`Error reading directory ${dir}: ${(error as Error).message}`);
      return;
    }
    for (const entry of entries) {
      const filePath = join(dir, entry);
      if (statSync(filePath).isDirectory()) walk(filePath);
      else if (entry.endsWith(".yaml")) convertFile(filePath);
    }
  };

  walk(dataDir);
}

// Mirrors gulp-rsync with { recursive, incremental, clean, progress, exclude }:
// -c (checksum, from "incremental"), -r, -R (relative, its default), -v, then
// the excludes, --progress, and --delete (from "clean"). No -t, so unchanged
// files are detected by checksum, not mtime.
async function push() {
  log(destDir);
  await run([
    "rsync", "-crRv",
    "--exclude=*.tpl", "--exclude=*.yaml", "--exclude=.DS_Store",
    "--progress", "--delete",
    "Library", destDir,
  ]);
}

async function clean() {
  const targets = new Set(generatedSettings);
  const walk = async (dir: string): Promise<void> => {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (error) {
      (error as NodeJS.ErrnoException).code != "ENOENT" &&
        logError(`Error reading directory ${dir}: ${(error as Error).message}`);
      return;
    }
    await Promise.all(
      entries.map(async (entry) => {
        const filePath = join(dir, entry);
        if ((await stat(filePath)).isDirectory()) return walk(filePath);
        if (!targets.has(entry)) return;
        try {
          await unlink(filePath);
          log(`Deleted: ${relative(root, filePath)}`);
        } catch (error) {
          logError(`Error deleting ${relative(root, filePath)}: ${(error as Error).message}`);
        }
      }),
    );
  };
  await walk(dataDir);
}

// The full pipeline. Order matters: data pulls .json from iCloud, so it must
// run before yaml2json for generated files to win over pulled copies.
async function sync() {
  await data();
  await inject();
  yaml2json();
  await push();
}

// --- watch -----------------------------------------------------------------

// Paths the watcher skips, relative to Library/. Dotfiles match gulp's glob,
// which does not match them. Data/**/*.json and the generated settings files
// are written by rebuilds themselves.
function isIgnored(path: string): boolean {
  const parts = path.split(sep);
  if (parts.some((part) => part.startsWith("."))) return true;
  if (parts[0] != "Data") return false;
  const name = parts[parts.length - 1];
  return name.endsWith(".json") || generatedSettings.includes(name);
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

async function copyOne(file: string) {
  const target = join(destDir, relative(root, file));
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
}

async function watchFiles() {
  // Serialize rebuilds so a burst of saves cannot interleave op inject with
  // yaml2json or two rsync runs.
  let queue = Promise.resolve();
  const enqueue = (label: string, task: () => unknown) => {
    queue = queue.then(async () => {
      log(`Rebuilding: ${label}`);
      try {
        await task();
      } catch (error) {
        logError(`Rebuild failed for ${label}: ${(error as Error).message}`);
      }
    });
  };

  const rebuildFromTpl = async () => {
    await inject();
    yaml2json();
    await push();
  };
  const rebuildFromYaml = async () => {
    yaml2json();
    await push();
  };

  // Files seen so far. A path that vanishes without ever being known (an
  // editor's temp file during an atomic save) is not a deletion.
  const known = new Set(listFiles(srcDir));

  const handle = (file: string) => {
    const label = relative(root, file);
    if (!existsSync(file)) {
      const removed = [...known].filter((path) => path == file || path.startsWith(file + sep));
      if (removed.length == 0) return;
      removed.forEach((path) => known.delete(path));
      // push runs rsync --delete, which is what propagates a removal.
      return enqueue(`${label} (removed)`, push);
    }

    if (statSync(file).isDirectory()) {
      // A folder moved or copied in: push picks up everything inside it.
      listFiles(file).forEach((path) => known.add(path));
      return enqueue(`${label}/`, push);
    }

    known.add(file);
    if (file.endsWith(".tpl")) return enqueue(label, rebuildFromTpl);
    if (file.endsWith(".yaml")) return enqueue(label, rebuildFromYaml);
    return enqueue(label, () => copyOne(file));
  };

  // fs.watch reports several events per save. Act once the path is quiet.
  const pending = new Map<string, Timer>();
  const watcher = watch(srcDir, { recursive: true }, (_event, filename) => {
    if (!filename || isIgnored(filename)) return;
    const file = join(srcDir, filename);
    clearTimeout(pending.get(file));
    pending.set(
      file,
      setTimeout(() => {
        pending.delete(file);
        try {
          handle(file);
        } catch (error) {
          logError(`Watcher could not handle ${relative(root, file)}: ${(error as Error).message}`);
        }
      }, 100),
    );
  });
  watcher.on("error", (error) => logError(`Watcher error: ${error.message}`));
  log(`Watching ${relative(root, srcDir)}/ for changes`);
}

async function watchTask() {
  await sync();
  await watchFiles();
}

const tasks: Record<string, () => unknown> = {
  sync,
  default: sync,
  watch: watchTask,
  data,
  inject,
  yaml2json,
  push,
  clean,
  debug,
};

const name = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "default";
const task = tasks[name];
if (!task) {
  console.error(`Unknown task "${name}". Tasks: ${Object.keys(tasks).join(", ")}`);
  process.exit(1);
}

try {
  log(`Starting '${name}'...`);
  const started = performance.now();
  await task();
  name != "watch" && log(`Finished '${name}' after ${Math.round(performance.now() - started)} ms`);
} catch (error) {
  logError((error as Error).message);
  process.exit(1);
}
