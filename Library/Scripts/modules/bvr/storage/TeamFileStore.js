// Season data for one team, kept in bvr/teams/<teamID>.json: a currentSeason
// pointer plus one entry per season holding its games, season record draft,
// and practice plans. Schema: docs/reference/bvr-team-file.md.
//
// Season and PracticePlan talk to this or to LegacySeasonStore through the
// same getters, so neither needs to know which file backs the team.
class TeamFileStore {
  static schemaVersion = 1;
  #file;

  // file: the parsed team file with a save() method (a DataFile in Drafts).
  constructor(file) {
    this.#file = file;
  }

  // The team's file, or undefined when the team has not been migrated yet.
  // Throws when the file exists but is not a usable team file (a half-synced
  // iCloud copy reads as empty), so nothing falls back or overwrites it.
  static load(path) {
    if (typeof DataFile == "undefined") require("modules/cp/filesystems/CloudFS.js");
    if (!DataFile.exists(path)) return undefined;

    const file = new DataFile(path);
    const problem = this.validate(file);
    if (problem != undefined) throw new Error(`${path} cannot be used: ${problem}`);
    return new TeamFileStore(file);
  }

  // Why data is not a usable team file, or undefined when it is. Same checks
  // as teamFileProblem in scripts/lib/bvr-team-file.ts (a shared fixture in
  // Library/Tests/fixtures/bvr/schema-cases.json keeps them in step).
  static validate(data) {
    const isObject = (value) => typeof value == "object" && value != null && !Array.isArray(value);
    if (!isObject(data)) return "the file is empty or not a JSON object";
    if (data.schemaVersion !== this.schemaVersion) return `unknown schemaVersion ${JSON.stringify(data.schemaVersion)}`;
    if (typeof data.teamID != "string" || data.teamID == "") return "teamID is missing";
    if (!isObject(data.seasons)) return "seasons is missing or not an object";
    if (data.currentSeason != null && typeof data.currentSeason != "string") return "currentSeason is not a string";
    return undefined;
  }

  // Season IDs start with the year they begin in, then a name: 2026-fall,
  // 2026-winter, 2026-27. The old files key seasons by that year.
  static isValidSeasonID(seasonID) {
    return /^\d{4}-[A-Za-z0-9][A-Za-z0-9-]*$/.test(`${seasonID}`);
  }

  // A new, empty team file. Nothing is written until the first save.
  static create(path, teamID) {
    if (typeof DataFile == "undefined") require("modules/cp/filesystems/CloudFS.js");
    DataFile.ensureDirectoryFor(path);
    const file = new DataFile(path);
    Object.assign(file, {
      schemaVersion: this.schemaVersion,
      teamID: teamID,
      currentSeason: null,
      seasons: {},
    });
    return new TeamFileStore(file);
  }

  // "2026-fall" reads "2026 Fall". Any other shape is its own label.
  static seasonLabel(seasonID) {
    const match = /^(\d{4})-([a-z]+)$/i.exec(`${seasonID}`);
    if (match == null) return `${seasonID}`;
    return `${match[1]} ${match[2].charAt(0).toUpperCase()}${match[2].slice(1)}`;
  }

  // Every key a season entry has. Later Start New Season steps fill the
  // null ones (recipients, attendanceDraftID).
  static emptySeason(seasonID) {
    return {
      label: this.seasonLabel(seasonID),
      startDate: null,
      endDate: null,
      formURLs: {},
      recipients: null,
      attendanceDraftID: null,
      seasonRecordDraftID: null,
      games: [],
      practicePlans: {},
    };
  }

  get isTeamFile() {
    return true;
  }

  get seasonID() {
    return this.#file.currentSeason;
  }

  get label() {
    return this.season?.label != undefined ? this.season.label : this.seasonID;
  }

  // The current season's entry, or undefined if the pointer is unset.
  get season() {
    return this.#file.seasons?.[this.seasonID];
  }

  get games() {
    return this.season?.games != undefined ? this.season.games : [];
  }

  set games(list) {
    this.season.games = list;
  }

  // An empty string from an old migration means "no draft", same as null.
  get seasonRecordDraftID() {
    const draftID = this.season?.seasonRecordDraftID;
    return draftID ? draftID : undefined;
  }

  set seasonRecordDraftID(draftID) {
    this.season.seasonRecordDraftID = draftID;
  }

  get startDate() {
    return this.season?.startDate ? this.season.startDate : undefined;
  }

  // True from Start New Season until the season's last day (today is
  // YYYY-MM-DD). A season with no last day stays active.
  isActiveOn(today) {
    if (this.season == undefined) return false;
    const endDate = this.season.endDate;
    return endDate == undefined || endDate >= today;
  }

  get practicePlans() {
    return this.season?.practicePlans;
  }

  // Form name to this season's URL. A file from before formURLs existed has
  // formURL: null instead, which reads as none.
  get formURLs() {
    return this.season?.formURLs ? this.season.formURLs : {};
  }

  saveFormURL(formName, url) {
    this.updateSeason(this.seasonID, { formURLs: { ...this.formURLs, [formName]: url } });
    this.save();
  }

  // Weeks restart with each season, so the week alone is the key.
  practicePlanKey(weekID) {
    return weekID;
  }

  savePracticePlan(key, draftID) {
    if (this.season.practicePlans == undefined) this.season.practicePlans = {};
    this.season.practicePlans[key] = draftID;
    this.save();
  }

  hasSeason(seasonID) {
    return this.#file.seasons?.[seasonID] != undefined;
  }

  // Any season's entry, not just the current one.
  seasonFor(seasonID) {
    return this.#file.seasons?.[seasonID];
  }

  // Add a season entry. details holds whatever the caller collected
  // (startDate and formURLs today; recipients and more in later phases).
  addSeason(seasonID, details = {}) {
    if (this.#file.seasons == undefined) this.#file.seasons = {};
    this.#file.seasons[seasonID] = {
      ...TeamFileStore.emptySeason(seasonID),
      ...details,
    };
  }

  setCurrentSeason(seasonID) {
    this.#file.currentSeason = seasonID;
  }

  // Change some of a season's fields (label, dates, recipients, formURLs,
  // attendanceDraftID); save() writes them. Writing formURLs drops the
  // formURL: null that files from before formURLs carry.
  updateSeason(seasonID, fields) {
    const entry = this.seasonFor(seasonID);
    Object.assign(entry, fields);
    if ("formURLs" in fields && entry.formURL === null) delete entry.formURL;
  }

  // Refuses to write anything that would not load back as a team file.
  save() {
    const problem = TeamFileStore.validate(this.#file);
    if (problem != undefined) throw new Error(`Team file not saved: ${problem}`);
    return this.#file.save();
  }
}
