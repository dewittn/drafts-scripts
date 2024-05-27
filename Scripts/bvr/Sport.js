class Sport {
  static settingsFile = "bvr/sports.yaml";
  #settings;

  constructor(type) {
    this.#settings = Settings.load(this.settingsFile);
    this.type = type;
  }

  get settingsFile() {
    return this.constructor.settingsFile;
  }

  get settings() {
    return this.#settings[this.type];
  }

  get maxScore() {
    const maxScore = this.#settings[this.type]?.maxScore;
    if (maxScore == undefined) return 17;

    return maxScore;
  }

  get selectedValue() {
    const selectedValue = this.#settings[this.type].selectedValue;
    if (selectedValue == undefined) return 6;

    return selectedValue;
  }
}
