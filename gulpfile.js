import { dest, series, src, watch } from "gulp";
import ext_replace from "gulp-ext-replace";
import rsync from "gulp-rsync";
import gulpExec, { reporter } from "gulp-exec";
import { exec } from "child_process";
import log from "fancy-log";
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

const _default = series(copyJSONData, injectSecrets, rsyncLibrary);
export { _default as default };
const _watch = series(copyJSONData, injectSecrets, rsyncLibrary, watchFiles);
export { _watch as watch };
export const sync = rsyncLibrary;
export const debug = logVaribles;
export const inject = injectSecrets;
export const data = copyJSONData;
