// Drafts load check: paste this file into a scratch draft and run the Eval
// Draft action on it (see docs/reference/drafts-runtime.md). Not a bun test.
//
// 1. Requires every file under Library/Scripts/modules/ and shared/ and
//    checks that its main class (or, with no class, its first function) is
//    defined afterward.
// 2. For each team in teams.json, builds its TeamConfig the way Team.config
//    does, reads the settings the actions use, and loads its team file. Then
//    loads the shared form links.
// Read-only: nothing is saved and no draft changes. The report, the last
// expression, names only files, classes, and team IDs, with pass or fail and
// the error message on failure. It never prints settings or file contents.
(() => {
  const lines = [];
  const counts = { pass: 0, fail: 0 };
  const scriptsRoot = "/Library/Scripts/";

  // Run one check; a failure is reported and the next check still runs.
  const check = (label, fn) => {
    try {
      const note = fn();
      counts.pass++;
      lines.push(`PASS ${label}${note ? ` (${note})` : ""}`);
    } catch (error) {
      counts.fail++;
      lines.push(`FAIL ${label}: ${error && error.message ? error.message : error}`);
    }
  };

  // typeof for a global name; top-level classes are not globalThis properties.
  const typeOfGlobal = (name) => Function(`return typeof ${name}`)();

  // Load a file unless what it defines is already there, as the scripts do.
  const need = (name, path) => {
    if (typeOfGlobal(name) == "undefined") require(path);
  };

  // Every .js file under a folder, as paths relative to Library/Scripts/.
  const fm = FileManager.createCloud();
  const listScripts = (folder) =>
    fm.listContents(`${scriptsRoot}${folder}`).sort().flatMap((entry) => {
      const name = entry.replace(/\/$/, "").split("/").pop();
      const path = `${folder}/${name}`;
      if (fm.isDirectory(`${scriptsRoot}${path}`)) return listScripts(path);
      return name.endsWith(".js") ? [path] : [];
    });

  // --- modules ---
  for (const folder of ["modules", "shared"]) {
    let paths = [];
    check(`list ${folder}/`, () => {
      paths = listScripts(folder);
      if (paths.length == 0) throw new Error(fm.lastError || "no .js files found");
      return `${paths.length} files`;
    });
    for (const path of paths) {
      check(`module ${path}`, () => {
        const source = fm.readString(`${scriptsRoot}${path}`) || "";
        const match = /^class\s+(\w+)/m.exec(source) || /^function\s+(\w+)/m.exec(source);
        if (match == null) {
          require(path);
          return "no class or function to check";
        }
        const name = match[1];
        need(name, path);
        if (typeOfGlobal(name) == "undefined") throw new Error(`${name} is not defined after require`);
        return name;
      });
    }
  }

  // --- BVR data ---
  // The paths BVR builds from bvr/settings.json, without constructing BVR
  // (its constructor switches the workspace).
  let bvr;
  check("bvr settings", () => {
    need("loadSettings", "vendor/nr.js");
    need("DataFile", "modules/cp/filesystems/CloudFS.js");
    need("Template", "modules/cp/templates/Template.js");
    need("Staff", "modules/bvr/utils/Staff.js");
    need("TeamConfig", "modules/bvr/utils/TeamConfig.js");
    need("TeamFileStore", "modules/bvr/storage/TeamFileStore.js");
    need("FormLinkStore", "modules/bvr/storage/FormLinkStore.js");
    const settings = loadSettings("bvr/settings.json");
    if (settings == undefined) throw new Error("bvr/settings.json could not be read");
    const prefix = settings.dirPrefix == undefined ? "" : settings.dirPrefix;
    const teamFilesDir = settings.teamFilesDir == undefined ? "teams/" : settings.teamFilesDir;
    const formLinksFile = settings.formLinksFile == undefined ? "formLinks.json" : settings.formLinksFile;
    bvr = {
      teamsFile: `${prefix}${settings.teamSettingsFile}`,
      levelFile: (level) => `${prefix}${settings.levelsDir}${level}.json`,
      forms: DataFile.load(`${prefix}${settings.formsFile}`),
      staff: Staff.load(`${prefix}${settings.staffFile}`),
      attendanceOffice: settings.attendanceOffice,
      teamFilePath: (teamID) => `${prefix}${teamFilesDir}${teamID}.json`,
      formLinksFile: `${prefix}${formLinksFile}`,
    };
  });

  let teams = [];
  if (bvr != undefined) {
    check("teams.json", () => {
      const teamsData = loadSettings(bvr.teamsFile)?.teamsData;
      if (!Array.isArray(teamsData)) throw new Error(`${bvr.teamsFile} could not be read, or has no teamsData list`);
      teams = teamsData;
      return `${teams.length} teams`;
    });
  }

  for (const team of teams) {
    check(`team ${team.id}`, () => {
      if (team.level == undefined) throw new Error("no level (ms or us)");
      const level = DataFile.load(bvr.levelFile(team.level));
      if (level == undefined) throw new Error(`no settings for level "${team.level}"`);
      const config = new TeamConfig({
        team,
        level,
        forms: bvr.forms,
        staff: bvr.staff,
        attendanceOffice: bvr.attendanceOffice,
        templateExists: (file) => new CloudFS(Template.basePath).exists(file),
      });
      // What the actions read, so a bad initial or form name fails here.
      config.templateSettings;
      config.defaultRecipients;
      config.formNames.forEach((name) => config.form(name));

      const store = TeamFileStore.load(bvr.teamFilePath(team.id));
      const seasonConfig = config.withSeasonRecipients(store?.season?.recipients);
      seasonConfig.attendanceSettings;
      seasonConfig.gameReportSettings;
      if (store == undefined) return "no team file, uses records.json";
      return store.season == undefined ? "team file, no current season" : "team file";
    });
  }

  if (bvr != undefined) {
    check("formLinks", () => {
      // FormLinkStore.load creates the folder for a missing file, so skip it.
      if (!DataFile.exists(bvr.formLinksFile)) return "no file yet, not loaded";
      FormLinkStore.load(bvr.formLinksFile);
    });
  }

  const header = `Drafts load check: ${counts.pass} passed, ${counts.fail} failed`;
  return [header, ...lines.filter((line) => line.startsWith("FAIL")), "", ...lines].join("\n");
})();
