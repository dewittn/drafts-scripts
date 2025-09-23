import { dest, series, src, watch } from "gulp";
import ext_replace from "gulp-ext-replace";
import rsync from "gulp-rsync";
import gulpExec, { reporter } from "gulp-exec";
import { exec } from "child_process";
import log from "fancy-log";
import { readdir, stat, unlink } from "fs/promises";
import { join } from "path";
const srcDir = "./Library";
const destDir =
  `${process.env.HOME}/Library/Mobile Documents/iCloud~com~agiletortoise~Drafts5/Documents`;

function logVaribles(cb) {
  log(`${srcDir}/*`);
  log(`${destDir}/`);
  cb();
}

function copyJSONData(cb) {
  exec(
    `rsync -r --progress --include='*.json' --exclude-from='./exclude-file.txt' '${destDir}/Library/' '${srcDir}'`,
  );
  cb();
}

function rsyncLibrary(cb) {
  log(destDir);
  src([`${srcDir}/`]).pipe(
    rsync({
      destination: `${destDir}/`,
      exclude: ["*.tpl", ".DS_Store"],
      progress: true,
      recursive: true,
      incremental: true,
      clean: true,
    }),
  );
  cb();
}

function watchFiles(cb) {
  watch(`${srcDir}/**`).on("change", function (file) {
    log(`Dest: ${file}`);
    log(`Dest: ${destDir}`);
    src(file, { base: "./" }).pipe(dest(`${destDir}/`));
  });
  cb();
}

function injectSecrets(cb) {
  const options = {
    continueOnError: false, // default = false, true means don't emit error event
    pipeStdout: true, // default = false, true means stdout is written to file.contents
  };
  const reportOptions = {
    err: false, // default = true, false means don't write err
    stderr: true, // default = true, false means don't write stderr
    stdout: false, // default = true, false means don't write stdout
  };
  src(`${srcDir}/**/*.tpl`)
    .pipe(gulpExec((file) => `op inject -i ${file.path}`, options))
    .pipe(reporter(reportOptions))
    .pipe(ext_replace(".yaml"))
    .pipe(dest(`${srcDir}`));
  cb();
}

async function cleanSettings(cb) {
  const filesToDelete = new Set([
    "gameReportSettings.yaml",
    "settings.yaml",
    "attendanceSettings.yaml",
    "templateSettings.yaml",
  ]);

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

const _default = series(copyJSONData, injectSecrets, rsyncLibrary);
export { _default as default };
const _watch = series(copyJSONData, injectSecrets, rsyncLibrary, watchFiles);
export { _watch as watch };
export const sync = rsyncLibrary;
export const debug = logVaribles;
export const inject = injectSecrets;
export const data = copyJSONData;
export const clean = cleanSettings;
