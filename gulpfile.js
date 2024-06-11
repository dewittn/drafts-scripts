const { src, dest, series, watch } = require("gulp");
const ext_replace = require("gulp-ext-replace");
const rsync = require("gulp-rsync");
const gulpExec = require("gulp-exec");
const exec = require("child_process").exec;
const log = require("fancy-log");
const srcDir = "./Library";
const destDir = `${process.env.HOME}/Library/Mobile Documents/iCloud~com~agiletortoise~Drafts5/Documents`;

function logVaribles(cb) {
  log(`${srcDir}/*`);
  log(`${destDir}/`);
  cb();
}

function copyJSONData(cb) {
  exec(
    `rsync -r --progress --include='*.json' --exclude-from='./exclude-file.txt' '${destDir}/Library/' '${srcDir}'`
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
    })
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
    .pipe(gulpExec.reporter(reportOptions))
    .pipe(ext_replace(".yaml"))
    .pipe(dest(`${srcDir}`));
  cb();
}

exports.default = series(copyJSONData, injectSecrets, rsyncLibrary, watchFiles);
exports.watch = watchFiles;
exports.sync = rsyncLibrary;
exports.debug = logVaribles;
exports.inject = injectSecrets;
exports.data = copyJSONData;
