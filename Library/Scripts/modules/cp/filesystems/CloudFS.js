class CloudFS {
  static regEx = /[^\\]*\.(\w+)$/;
  #fmCloud;
  #basePath;

  constructor(basePath) {
    this.#basePath = basePath;
    this.#fmCloud = FileManager.createCloud();
  }

  get regEx() {
    return this.constructor.regEx;
  }

  get lastError() {
    return this.#fmCloud.lastError;
  }

  get basePath() {
    return this.#basePath;
  }

  read(fileName) {
    if (fileName == undefined) return undefined;

    const extention = this.regEx.exec(fileName)[1];
    let filePath = `${this.basePath}/${fileName}`;

    switch (extention) {
      case "yaml":
        // YAML files are converted to JSON at build time
        CloudFS.warnDeprecatedYAML(fileName);
        filePath = filePath.replace(/\.yaml$/, ".json");
        return this.#fmCloud.readJSON(filePath);
        break;
      case "json":
        return this.#fmCloud.readJSON(filePath);
        break;
      case "md":
      default:
        return this.#fmCloud.readString(filePath);
    }
  }

  write(fileName, data) {
    const extention = this.regEx.exec(fileName)[1];
    let filePath = `${this.basePath}/${fileName}`;

    switch (extention) {
      case "yaml":
        // YAML files are converted to JSON at build time
        CloudFS.warnDeprecatedYAML(fileName);
        filePath = filePath.replace(/\.yaml$/, ".json");
        const scrubbedYamlData = JSON.parse(JSON.stringify(data));
        return this.#fmCloud.writeJSON(filePath, scrubbedYamlData);
        break;
      case "json":
        // fix to prevent JSONSerialization from crashing
        const scrubbedData = JSON.parse(JSON.stringify(data));
        return this.#fmCloud.writeJSON(filePath, scrubbedData);
        break;
      default:
        return this.#fmCloud.writeString(filePath, data);
    }
  }

  exists(fileName) {
    if (fileName == undefined) return false;
    return this.#fmCloud.exists(`${this.basePath}/${fileName}`);
  }

  // Create each missing folder along dirPath (relative to basePath), so a
  // write to a new folder does not fail.
  ensureDirectory(dirPath) {
    let parent = this.basePath;
    for (const name of dirPath.split("/").filter((part) => part != "")) {
      const path = `${parent}/${name}`;
      if (!this.#fmCloud.exists(path)) this.#fmCloud.createDirectory(name, parent);
      parent = path;
    }
  }

  // Deprecated: callers should name the .json file the build produces.
  // The swap to .json keeps old references working while this flags them.
  // Also used by loadSettings in vendor/nr.js; source names the caller.
  static warnDeprecatedYAML(fileName, source = "CloudFS") {
    const message = `Deprecated .yaml reference: ${fileName} (use .json)`;
    console.log(`[${source}] ${message}`);
    if (typeof app != "undefined") app.displayWarningMessage(message);
  }
}

class DataFile {
  static basePath = "/Library/Data";
  #fs;
  #file;
  #needsFolder = false;

  constructor(file) {
    this.#fs = new CloudFS(this.basePath);
    this.#file = file;

    Object.assign(this, this.#load(this.#file));
  }

  get basePath() {
    return this.constructor.basePath;
  }

  static load(fileName) {
    const fs = new CloudFS(this.basePath);
    return fs.read(fileName);
  }

  static exists(fileName) {
    const fs = new CloudFS(this.basePath);
    return fs.exists(fileName);
  }

  // Create the folders a new data file needs, e.g. "bvr/teams/" for
  // "bvr/teams/msg-soccer.json".
  static ensureDirectoryFor(fileName) {
    const fs = new CloudFS(this.basePath);
    fs.ensureDirectory(fileName.split("/").slice(0, -1).join("/"));
  }

  // A plain JSON object: not null, not an array.
  static isObject(value) {
    return typeof value == "object" && value != null && !Array.isArray(value);
  }

  // The file, or undefined when it does not exist. validate(data) returns a
  // problem or undefined; a problem throws, so an unusable file (a half-synced
  // iCloud copy reads as empty) is never used or overwritten.
  static loadValidated(fileName, validate) {
    if (!this.exists(fileName)) return undefined;

    const file = new DataFile(fileName);
    const problem = validate(file);
    if (problem != undefined) throw new Error(`${fileName} cannot be used: ${problem}`);
    return file;
  }

  // A new file holding data. Nothing is written, and no folder is made,
  // until the first save.
  static create(fileName, data) {
    const file = new DataFile(fileName);
    Object.assign(file, data);
    file.#needsFolder = true;
    return file;
  }

  // Saves file (a DataFile, or anything with save()) only when validate(file)
  // finds no problem; otherwise throws "<what> not saved: <problem>".
  static saveValidated(file, validate, what) {
    const problem = validate(file);
    if (problem != undefined) throw new Error(`${what} not saved: ${problem}`);
    return file.save();
  }

  #load(fileName) {
    return this.#fs.read(fileName);
  }

  save() {
    if (this.#needsFolder) DataFile.ensureDirectoryFor(this.#file);
    this.#needsFolder = false;
    return this.#fs.write(this.#file, this);
  }
}

class Settings {
  #source;

  constructor(fileName, section) {
    const data = DataFile.load(fileName);
    const keys = section == undefined ? data : data[section];
    this.#source = section == undefined ? fileName : `${fileName} [${section}]`;

    Object.assign(this, keys);
  }

  // Throws on a missing key so typos and gaps in the settings file surface
  // with the key name, instead of as undefined further down the line.
  load(key) {
    if (!Object.hasOwn(this, key)) {
      throw new Error(`[Settings] "${key}" not found in ${this.#source}`);
    }
    return this[key];
  }

  get basePath() {
    return this.constructor.basePath;
  }

  get ui() {
    if (this.uiSettingsFile) {
      return DataFile.load(`${this.dirPrefix}${this.uiSettingsFile}`);
    }

    return this.uiSettings;
  }

  static load(fileName) {
    return DataFile.load(fileName);
  }
}
