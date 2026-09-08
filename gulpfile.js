import { dest, series, src, watch } from "gulp";
import ext_replace from "gulp-ext-replace";
import rsync from "gulp-rsync";
import gulpExec, { reporter } from "gulp-exec";
import { exec } from "child_process";
import log from "fancy-log";
import { readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import yaml from "js-yaml";
import { readFileSync, writeFileSync } from "fs";
import { readdirSync, statSync } from "fs";
const srcDir = "./Library";
const destDir =
  `${process.env.HOME}/Library/Mobile Documents/iCloud~com~agiletortoise~Drafts5/Documents`;

// Build artifacts: .yaml generated from .tpl by injectSecrets, .json generated from
// .yaml by convertYamlToJson. Excluded from the watcher so a rebuild's own writes
// don't retrigger it.
const generatedSettings = [
  "gameReportSettings.yaml",
  "settings.yaml",
  "attendanceSettings.yaml",
  "templateSettings.yaml",
];
const watchGlobs = [
  `${srcDir}/**`,
  `!${srcDir}/Data/**/*.json`,
  ...generatedSettings.map((name) => `!${srcDir}/Data/**/${name}`),
];

function logVaribles(cb) {
  log(`${srcDir}/*`);
  log(`${destDir}/`);
  cb();
}

function copyJSONData() {
  return new Promise((resolve, reject) => {
    exec(
      `rsync -r --progress --include='*.json' --exclude-from='./exclude-file.txt' '${destDir}/Library/' '${srcDir}'`,
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

function rsyncLibrary() {
  log(destDir);
  return src([`${srcDir}/`]).pipe(
    rsync({
      destination: `${destDir}/`,
      exclude: ["*.tpl", ".DS_Store"],
      progress: true,
      recursive: true,
      incremental: true,
      clean: true,
    }),
  );
}

function watchFiles() {
  // series() wraps each task so its returned stream/promise resolves the callback.
  // Calling rsyncLibrary bare would never signal completion and would stall the queue.
  const rebuildFromTpl = series(injectSecrets, convertYamlToJson, rsyncLibrary);
  const rebuildFromYaml = series(convertYamlToJson, rsyncLibrary);
  const pushOnly = series(rsyncLibrary);

  // Serialize rebuilds so a burst of saves can't interleave op inject with yaml2json.
  let queue = Promise.resolve();
  const enqueue = (label, task) => {
    queue = queue.then(
      () =>
        new Promise((resolve) => {
          log(`Rebuilding: ${label}`);
          task((err) => {
            err && log.error(`Rebuild failed for ${label}: ${err.message}`);
            resolve();
          });
        }),
    );
    return queue;
  };

  const copyFile = (file) => (cb) => {
    const stream = src(file, { base: "./" }).pipe(dest(`${destDir}/`));
    stream.on("error", (err) => cb(err));
    stream.on("end", () => cb());
    stream.resume();
  };

  const onChange = (file) =>
    file.endsWith(".tpl")
      ? enqueue(file, rebuildFromTpl)
      : file.endsWith(".yaml")
        ? enqueue(file, rebuildFromYaml)
        : enqueue(file, copyFile(file));

  const watcher = watch(watchGlobs, { ignoreInitial: true });
  watcher.on("change", onChange);
  watcher.on("add", onChange);
  // rsyncLibrary runs with --delete, so a full push is what propagates a removal.
  watcher.on("unlink", (file) => enqueue(`${file} (removed)`, pushOnly));

  return watcher;
}

function injectSecrets() {
  const options = {
    continueOnError: false, // default = false, true means don't emit error event
    pipeStdout: true, // default = false, true means stdout is written to file.contents
  };
  const reportOptions = {
    err: false, // default = true, false means don't write err
    stderr: true, // default = true, false means don't write stderr
    stdout: false, // default = true, false means don't write stdout
  };
  return src(`${srcDir}/**/*.tpl`)
    .pipe(gulpExec((file) => `op inject -i ${file.path}`, options))
    .pipe(reporter(reportOptions))
    .pipe(ext_replace(".yaml"))
    .pipe(dest(`${srcDir}`));
}

async function cleanSettings(cb) {
  const filesToDelete = new Set(generatedSettings);

  const deleteFile = async (filePath) => {
    try {
      await unlink(filePath);
      log(`Deleted: ${filePath}`);
    } catch (err) {
      log.error(`Error deleting ${filePath}: ${err.message}`);
    }
  };

  const processEntry = async (dir, entry) => {
    const filePath = join(dir, entry);
    const fileStat = await stat(filePath);

    return fileStat.isDirectory()
      ? findAndDeleteFiles(filePath)
      : filesToDelete.has(entry) && deleteFile(filePath);
  };

  const findAndDeleteFiles = async (dir) => {
    try {
      const entries = await readdir(dir);
      await Promise.all(entries.map(entry => processEntry(dir, entry)));
    } catch (err) {
      err.code !== "ENOENT" && log.error(`Error reading directory ${dir}: ${err.message}`);
    }
  };

  await findAndDeleteFiles(join(srcDir, "Data"));
  cb();
}

function convertYamlToJson(cb) {
  const convertFile = (filePath) => {
    try {
      const yamlContent = readFileSync(filePath, "utf8");
      const jsonData = yaml.load(yamlContent);
      const jsonFilePath = filePath.replace(/\.yaml$/, ".json");
      writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));
      log(`Converted: ${filePath} → ${jsonFilePath}`);
    } catch (err) {
      log.error(`Error converting ${filePath}: ${err.message}`);
    }
  };

  const processEntry = (dir, entry) => {
    const filePath = join(dir, entry);
    const fileStat = statSync(filePath);

    if (fileStat.isDirectory()) {
      findAndConvertYaml(filePath);
    } else if (entry.endsWith(".yaml")) {
      convertFile(filePath);
    }
  };

  const findAndConvertYaml = (dir) => {
    try {
      const entries = readdirSync(dir);
      entries.forEach(entry => processEntry(dir, entry));
    } catch (err) {
      if (err.code !== "ENOENT") {
        log.error(`Error reading directory ${dir}: ${err.message}`);
      }
    }
  };

  findAndConvertYaml(join(srcDir, "Data"));
  cb();
}

const _default = series(copyJSONData, injectSecrets, convertYamlToJson, rsyncLibrary);
export { _default as default };
const _watch = series(copyJSONData, injectSecrets, convertYamlToJson, rsyncLibrary, watchFiles);
export { _watch as watch };
export const sync = series(copyJSONData, injectSecrets, convertYamlToJson, rsyncLibrary);
export const debug = logVaribles;
export const inject = injectSecrets;
export const data = copyJSONData;
export const clean = cleanSettings;
export const yaml2json = convertYamlToJson;
