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
        this.#warnYaml(fileName);
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
        this.#warnYaml(fileName);
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
  #warnYaml(fileName) {
    const message = `Deprecated .yaml reference: ${fileName} (use .json)`;
    console.log(`[CloudFS] ${message}`);
    if (typeof app != "undefined") app.displayWarningMessage(message);
  }
}

class DataFile {
  static basePath = "/Library/Data";
  #fs;
  #file;

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

  #load(fileName) {
    return this.#fs.read(fileName);
  }

  save() {
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
