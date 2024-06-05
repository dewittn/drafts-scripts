const { src, dest, series, watch } = require("gulp");
const rsync = require("gulp-rsync");
const log = require("fancy-log");
const srcDir = "./Library";
const destDir = `${process.env.HOME}/Library/Mobile Documents/iCloud~com~agiletortoise~Drafts5/Documents/Library`;

function logVaribles(cb) {
  log(`${srcDir}/*`);
  log(`${destDir}/`);
  cb();
}

function rsyncLibrary() {
  return src(`${srcDir}/**`).pipe(
    rsync({
      root: "${destDir}/",
      destination: `${destDir}/${path}`,
      recursive: true,
      verbose: true,
    })
  );
}

function watchFiles() {
  watch(`${srcDir}/**`).on("change", function (path) {
    log(`Path: ${path}`);
    log(`Dest: ${destDir}`);
    src(path).pipe(dest(`${destDir}/${path}`));
  });
}

exports.default = logVaribles;
exports.watch = watchFiles;
exports.clean = rsyncLibrary;
