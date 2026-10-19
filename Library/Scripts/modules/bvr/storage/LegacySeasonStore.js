// Season data the pre-team-file way: records.json keyed by team and calendar
// year, practicePlans.json keyed by team and "<year>W<week>". Season uses this
// for a team with no team file yet, so the old behavior is unchanged.
//
// Exposes the same getters as TeamFileStore. Both files load on first use.
class LegacySeasonStore {
  #teamID;
  #year;
  #startDate;
  #loadRecords;
  #loadPracticePlans;
  #records;
  #ppData;

  // loadRecords / loadPracticePlans return the parsed file with a save()
  // method (a DataFile in Drafts). startDate is the team's from teams.yaml.
  constructor({ teamID, year, startDate, loadRecords, loadPracticePlans }) {
    this.#teamID = teamID;
    this.#year = year;
    this.#startDate = startDate;
    this.#loadRecords = loadRecords;
    this.#loadPracticePlans = loadPracticePlans;
  }

  get isTeamFile() {
    return false;
  }

  get records() {
    if (this.#records == undefined) this.#records = this.#loadRecords();
    return this.#records;
  }

  get ppData() {
    if (this.#ppData == undefined) this.#ppData = this.#loadPracticePlans();
    return this.#ppData;
  }

  get teamHistory() {
    if (this.records[this.#teamID] == undefined) this.records[this.#teamID] = {};
    return this.records[this.#teamID];
  }

  // The season is the calendar year, as a number.
  get seasonID() {
    return this.#year;
  }

  get label() {
    return `${this.#year}`;
  }

  get season() {
    if (this.teamHistory[this.#year] == undefined) this.teamHistory[this.#year] = {};
    return this.teamHistory[this.#year];
  }

  get games() {
    const record = this.season.seasonRecordData;
    return record != undefined ? record : [];
  }

  set games(list) {
    this.season.seasonRecordData = list;
  }

  get seasonRecordDraftID() {
    return this.teamHistory[this.#year]?.seasonRecordDraftID;
  }

  set seasonRecordDraftID(draftID) {
    this.season.seasonRecordDraftID = draftID;
  }

  get startDate() {
    return this.#startDate;
  }

  get practicePlans() {
    return this.ppData[this.#teamID];
  }

  // Form URLs live on this year's season object in records.json, a key the
  // old code ignores, so an unmigrated team can still submit its forms.
  get formURLs() {
    return this.season.formURLs ? this.season.formURLs : {};
  }

  saveFormURL(formName, url) {
    this.season.formURLs = { ...this.formURLs, [formName]: url };
    this.saveGames();
  }

  practicePlanKey(weekID) {
    return `${this.#year}${weekID}`;
  }

  savePracticePlan(key, draftID) {
    if (this.practicePlans == undefined) this.ppData[this.#teamID] = {};
    this.practicePlans[key] = draftID;
    this.ppData.save();
  }

  // Whether either old file holds anything for this team. Reads without
  // creating the team's entry.
  get hasTeamData() {
    const hasKeys = (value) => value != undefined && Object.keys(value).length > 0;
    return hasKeys(this.records[this.#teamID]) || hasKeys(this.ppData[this.#teamID]);
  }

  saveGames() {
    this.records.save();
  }
}
