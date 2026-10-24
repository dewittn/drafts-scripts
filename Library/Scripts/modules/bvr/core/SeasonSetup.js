if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
if (typeof FormLinkStore == "undefined") require("modules/bvr/storage/FormLinkStore.js");
if (typeof TeamConfig == "undefined") require("modules/bvr/utils/TeamConfig.js");

// Start New Season for one team: the season prompt, the form links its term
// lacks, who gets messages, the season record draft, and the roster draft.
// Season.startNewSeason() runs it; Edit Season reuses its roster draft,
// unknown-initials check, and retries.
class SeasonSetup {
  #season;
  #tmplSettings;

  // season: the team's Season (store, form links, team). tmplSettings: the
  // team's template settings, for the roster draft's template.
  constructor(season, tmplSettings) {
    this.#season = season;
    this.#tmplSettings = tmplSettings;
  }

  // Ask up to three times: ask(previous) shows the prompt prefilled with the
  // rejected answer (undefined on cancel); isAccepted(answer) says what is wrong.
  static askUpToThreeTimes(ask, isAccepted) {
    let previous;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const answer = ask(previous);
      if (answer == undefined) return undefined;
      if (isAccepted(answer)) return answer;
      previous = answer;
    }
    return undefined;
  }

  get #ui() {
    return this.#season.ui;
  }

  get #bvr() {
    return this.#season.bvr;
  }

  get #team() {
    return this.#season.team;
  }

  get #store() {
    return this.#season.store;
  }

  get #links() {
    return this.#season.seasonFormLinks;
  }

  // **********************
  // Public Functions
  // **********************

  // A team with old-file history but no team file keeps the old flow until
  // migrated. Every other team gets a team-file season (and file, if needed).
  start() {
    if (!this.#season.usesTeamFile && this.#store.hasTeamData) return this.#startLegacySeason();
    return this.#startTeamFileSeason();
  }

  // A roster draft from the team's attendance template. Its [[team_abbr]] and
  // [[season_label]] tags make the title Update Roster compares (Team.rosterTitle).
  createAttendanceDraft(seasonLabel) {
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    const { templateFile } = this.#tmplSettings.attendance;
    const roster = new Template({
      templateFile,
      draftTags: this.#season.defaultDraftTags,
      templateTags: { team_abbr: this.#team.abbr, season_label: seasonLabel },
    });
    roster.save();
    return roster;
  }

  draftTitle(draftID) {
    const found = typeof Draft == "undefined" ? undefined : Draft.find(draftID);
    return found?.displayTitle || "the current roster draft";
  }

  // Names the initials staff.yaml.tpl does not know. True if there were any.
  reportUnknownInitials(lists) {
    const unknown = this.#bvr.staff.unknown([...new Set([...lists.attendance, ...lists.gameReport])]);
    if (unknown.length == 0) return false;
    this.#ui.displayAppMessage("info", `No one in staff.yaml.tpl has the initials ${unknown.join(", ")}. Check them and try again.`);
    return true;
  }

  // **********************
  // Starting a season
  // **********************

  // Old files: give this calendar year a season record draft, as before.
  #startLegacySeason() {
    if (this.#season.seasonRecordDraftID != undefined) {
      return this.#ui.displayAppMessage(
        "info",
        `${this.#season.teamName} already has a season record draft for ${this.#season.currentSeasonID}.`,
      );
    }
    this.#createSeasonRecordDraft();
  }

  // Add the prompted season, make it current, and give it a season record
  // draft. A season that already exists is completed instead.
  #startTeamFileSeason() {
    const details = this.#promptForNewSeason();
    if (details == undefined) return;

    if (this.#season.usesTeamFile && this.#store.hasSeason(details.seasonID)) {
      return this.#completeExistingSeason(details);
    }
    // The roster draft in use now, before the new season becomes current.
    const rosterBefore = this.#team.attendanceDraftID;
    if (!this.#season.usesTeamFile) {
      this.#season.store = TeamFileStore.create(this.#season.teamFilePath, this.#season.teamID);
    }

    // Form links the term lacks, then who gets messages, then (once the
    // season exists) the roster draft.
    const label = TeamFileStore.seasonLabel(details.seasonID);
    const formURLs = this.#promptForMissingLinks(details.seasonID, {}, label);
    const recipients = this.#promptForRecipients(this.#team.defaultRecipients);
    this.#store.addSeason(details.seasonID, {
      startDate: details.startDate,
      formURLs,
      recipients: recipients == undefined ? null : recipients,
    });
    this.#store.setCurrentSeason(details.seasonID);
    this.#createSeasonRecordDraft();
    this.#settleAttendanceDraft(details.seasonID, rosterBefore, label);
  }

  // bvr:migrate creates the teams.yaml season with no record draft: make it
  // current and add what it lacks. Only one that had a draft "already exists".
  #completeExistingSeason({ seasonID, startDate }) {
    const entry = this.#store.seasonFor(seasonID);
    const wasCurrent = this.#season.currentSeasonID == seasonID;
    const hadDraft = Boolean(entry.seasonRecordDraftID);
    const filledStartDate = !entry.startDate;
    this.#links.liftSeasonLinks(seasonID);
    const savedURLs = entry.formURLs || {};
    const newURLs = this.#promptForMissingLinks(seasonID, savedURLs, entry.label || seasonID);
    const addedURLs = Object.keys(newURLs).length > 0;

    const fields = {};
    if (filledStartDate) fields.startDate = startDate;
    if (addedURLs) fields.formURLs = { ...savedURLs, ...newURLs };
    this.#store.updateSeason(seasonID, fields);
    const rosterBefore = this.#team.attendanceDraftID;
    const needsRoster = !entry.attendanceDraftID;
    this.#store.setCurrentSeason(seasonID);
    if (!hadDraft) this.#createSeasonRecordDraft();
    if (needsRoster) this.#settleAttendanceDraft(seasonID, rosterBefore, entry.label || seasonID);
    if (!hadDraft || needsRoster) return;

    if (!wasCurrent || filledStartDate || addedURLs) this.#store.save();
    const message = wasCurrent
      ? `${this.#season.teamName} already has a ${seasonID} season.`
      : `${seasonID} is now the current season. It already had a season record draft.`;
    return this.#ui.displayAppMessage("info", message);
  }

  #createSeasonRecordDraft() {
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    const seasonRecordDraft = new Template(this.#season.tmplSettingsSeasonRecord);
    seasonRecordDraft.archive().save();

    this.#store.seasonRecordDraftID = seasonRecordDraft.draftID;
    this.#store.save();

    return this.#ui.displayAppMessage("success", "Season record draft created.");
  }

  // **********************
  // Season prompt
  // **********************

  // The new season's ID and start date, asked again while the ID is not
  // <year>-<name>. Undefined if cancelled or no valid ID is given.
  #promptForNewSeason() {
    return SeasonSetup.askUpToThreeTimes(
      (previous) => this.#showNewSeasonPrompt(previous ? previous.seasonID : this.#defaultNewSeasonID()),
      (answer) => this.#isSeasonName(answer.seasonID),
    );
  }

  #isSeasonName(seasonID) {
    if (TeamFileStore.isValidSeasonID(seasonID)) return true;
    this.#ui.displayAppMessage(
      "info",
      `"${seasonID}" is not a season name. Start with the year, then a name: 2026-winter or 2026-27.`,
    );
    return false;
  }

  // ui.settings() hands back the same object every time, so each attempt
  // works on a copy; pushing into the shared one would repeat the fields.
  #showNewSeasonPrompt(initialSeasonID) {
    const section = this.#ui.settingsCopy("startNewSeason");
    const { menuSettings, seasonIDField, startDateField } = section;
    seasonIDField.data.initialText = initialSeasonID;
    startDateField.data.initialDate = this.#comingMonday();
    menuSettings.menuItems.push(seasonIDField, startDateField);

    const seasonPrompt = this.#ui.buildMenu(menuSettings);
    if (seasonPrompt.show() == false) return undefined;

    const seasonID = `${seasonPrompt.fieldValues[seasonIDField.data.name] || ""}`.trim();
    const startDate = seasonPrompt.fieldValues[startDateField.data.name];
    return { seasonID, startDate: this.#bvr.formatDateYMD(startDate) };
  }

  // "<year>-<season>" from teams.yaml, e.g. 2026-fall. Any name is accepted
  // at the prompt, so a winter sport can use 2026-winter or 2026-27.
  #defaultNewSeasonID() {
    const year = new Date().getFullYear();
    const seasonName = this.#team.seasonName;
    return seasonName ? `${year}-${seasonName}` : `${year}`;
  }

  // Today if it is a Monday, otherwise the next Monday.
  #comingMonday(today = new Date()) {
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysAhead = (8 - monday.getDay()) % 7;
    monday.setDate(monday.getDate() + daysAhead);
    return monday;
  }

  // **********************
  // Form links and recipients
  // **********************

  // Ask for the links neither the season nor its term has. Shared links are
  // saved here; the ones that belong on the season are returned for it.
  #promptForMissingLinks(seasonID, seasonURLs, seasonLabel) {
    const term = FormLinkStore.termFor(seasonID);
    const missing = this.#team.formNames.filter((formName) => !this.#links.effective(formName, seasonURLs, term).url);
    const given = this.#promptForFormURLs(missing, seasonLabel);
    const placed = this.#links.place(term, seasonURLs, given);
    if (placed.shared.length > 0) this.#season.formLinks.save();
    return placed.season;
  }

  // { <form name>: link } for the links given; blanks are left out, to be
  // asked for at Submit Game Report.
  #promptForFormURLs(formNames, seasonLabel) {
    const formURLs = {};
    for (const formName of formNames) {
      const url = this.#season.promptForFormURL(formName, seasonLabel);
      if (url != undefined) formURLs[formName] = url;
    }
    return formURLs;
  }

  // Who gets messages, asked again while it names unknown initials. Returns
  // TeamConfig.recipientOverrides (null for the defaults), undefined if cancelled.
  #promptForRecipients(current) {
    const defaults = this.#team.defaultRecipients;
    const lists = SeasonSetup.askUpToThreeTimes(
      (previous) => this.#showRecipientsPrompt(previous || current, defaults),
      (typed) => !this.reportUnknownInitials(typed),
    );
    return lists == undefined ? undefined : TeamConfig.recipientOverrides(lists, defaults);
  }

  #showRecipientsPrompt(lists, defaults) {
    const section = this.#ui.settingsCopy("recipientsPrompt");
    const { menuSettings, attendanceField, gameReportField } = section;
    attendanceField.data.initialText = lists.attendance.join(", ");
    gameReportField.data.initialText = lists.gameReport.join(", ");
    menuSettings.menuItems.push(attendanceField, gameReportField);

    const recipientsPrompt = this.#ui.buildMenu(menuSettings);
    if (recipientsPrompt.show() == false) return undefined;
    return TeamConfig.typedRecipients(recipientsPrompt.fieldValues, defaults);
  }

  // **********************
  // Roster draft
  // **********************

  // Give a season its roster draft: keep the one in use (rosterBefore) or
  // start a new one, asking first when there is one to keep. Saves the season.
  #settleAttendanceDraft(seasonID, rosterBefore, seasonLabel) {
    if (rosterBefore && this.#askKeepRoster(rosterBefore, seasonLabel)) {
      this.#store.updateSeason(seasonID, { attendanceDraftID: rosterBefore });
      this.#store.save();
      return;
    }

    const roster = this.createAttendanceDraft(seasonLabel);
    this.#store.updateSeason(seasonID, { attendanceDraftID: roster.draftID });
    this.#store.save();
    this.#bvr.pinDraft(roster.draft);
    this.#ui.displayAppMessage(
      "success",
      `Roster draft for ${seasonLabel} created and opened. Add the players; next season, keep it and run Update Roster to move everyone up a grade.`,
    );
  }

  // True to keep the current roster draft. Keep is the default, and so is
  // cancelling, so nothing is created by accident.
  #askKeepRoster(draftID, seasonLabel) {
    const section = this.#ui.settingsCopy("attendanceDraftPrompt");
    const { menuSettings } = section;
    menuSettings.menuMessage = menuSettings.menuMessage
      .replace("[[roster]]", () => this.draftTitle(draftID))
      .replace("[[season]]", () => seasonLabel);
    const rosterPrompt = this.#ui.buildMenu(menuSettings);
    if (rosterPrompt.show() == false) return true;
    return rosterPrompt.buttonPressed != "new";
  }
}
