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
  static load(path) {
    if (typeof DataFile == "undefined") require("modules/cp/filesystems/CloudFS.js");
    if (!DataFile.exists(path)) return undefined;
    return new TeamFileStore(new DataFile(path));
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
  // null ones (formURL, recipients, attendanceDraftID).
  static emptySeason(seasonID) {
    return {
      label: this.seasonLabel(seasonID),
      startDate: null,
      endDate: null,
      formURL: null,
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

  get practicePlans() {
    return this.season?.practicePlans;
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

  // Add a season entry. details holds whatever the caller collected
  // (startDate today; formURL, recipients and more in later phases).
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

  saveGames() {
    this.save();
  }

  save() {
    return this.#file.save();
  }
}
