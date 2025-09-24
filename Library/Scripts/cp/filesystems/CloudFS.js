require("libraries/js-yaml.js");

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
    const filePath = `${this.basePath}/${fileName}`;

    switch (extention) {
      case "yaml":
        return YAML.parse(this.#fmCloud.readString(filePath));
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
    const filePath = `${this.basePath}/${fileName}`;

    switch (extention) {
      case "yaml":
        const yamlData = YAML.parse(data);
        return this.#fmCloud.writeString(filePath, yamlData);
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

  #load(fileName) {
    return this.#fs.read(fileName);
  }

  save() {
    return this.#fs.write(this.#file, this);
  }
}

class Settings {
  constructor(fileName, section) {
    const data = DataFile.load(fileName);
    const keys = section == undefined ? data : data[section];

    Object.assign(this, keys);
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

class SettingsV2 {
  #dataMap;

  constructor(fileName, section) {
    const data = DataFile.load(fileName);
    const keys = section == undefined ? data : data[section];
    // Convert object to Map
    this.#dataMap = new Map(Object.entries(keys));
  }

  // Method to retrieve values from the Map
  load(key) {
    return this.#dataMap.get(key);
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
