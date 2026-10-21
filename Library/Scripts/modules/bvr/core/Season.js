// A team's current season: its games, season record draft, and practice
// plans. The data lives in the team file (bvr/teams/<teamID>.json) once the
// team is migrated, and in records.json + practicePlans.json until then.
// `store` picks one per run; everything else goes through it.
class Season {
  #bvr;
  #team;
  #tmplSettings;
  #store;
  #formLinks;
  #dependencies;

  constructor(dependencies) {
    // Store dependencies but don't instantiate if not provided
    this.#dependencies = dependencies;

    if (dependencies != undefined) {
      this.#bvr = dependencies.bvr;
      this.#team = dependencies.team;
      this.#tmplSettings = dependencies.tmplSettings;
    }
  }

  get bvr() {
    if (!this.#bvr && this.#dependencies == undefined) {
      if (typeof BVR == "undefined") require("modules/bvr/core/BVR.js");
      this.#bvr = new BVR();
    }
    return this.#bvr;
  }

  get team() {
    if (!this.#team && this.#dependencies == undefined) {
      if (typeof Team == "undefined") require("modules/bvr/core/Team.js");
      this.#team = new Team();
    }
    return this.#team;
  }

  // The team file if the team has one, otherwise the old files.
  get store() {
    if (!this.#store) this.#store = this.#selectStore();
    return this.#store;
  }

  set store(value) {
    this.#store = value;
  }

  // Score-form links shared by every team in a term (bvr/formLinks.json).
  // An unusable file stops the action, as an unusable team file does.
  get formLinks() {
    if (!this.#formLinks) {
      if (typeof FormLinkStore == "undefined") require("modules/bvr/storage/FormLinkStore.js");
      try {
        this.#formLinks = FormLinkStore.load(this.bvr.formLinksFile);
      } catch (error) {
        const message = `${error.message}. Nothing was changed. If iCloud is still syncing, wait and try again.`;
        this.ui.displayAppMessage("error", message);
        throw new Error(message);
      }
    }
    return this.#formLinks;
  }

  set formLinks(value) {
    this.#formLinks = value;
  }

  // "2026-fall" for a 2026-fall season; undefined for a season with no term
  // (2026-27, or a team on the old files).
  get term() {
    if (!this.usesTeamFile) return undefined;
    if (typeof FormLinkStore == "undefined") require("modules/bvr/storage/FormLinkStore.js");
    return FormLinkStore.termFor(this.currentSeasonID);
  }

  get usesTeamFile() {
    return this.store.isTeamFile;
  }

  get ui() {
    return this.bvr.ui;
  }

  get globalTemplateTags() {
    return this.bvr.globalTags;
  }

  get defaultDraftTags() {
    return [this.team.defaultTag];
  }

  get recordsFile() {
    return this.bvr.recordsFile;
  }

  get teamFilePath() {
    return this.bvr.teamFilePath(this.teamID);
  }

  get teamID() {
    return this.team.id;
  }

  get teamName() {
    return this.team.name;
  }

  // "2026-fall" from a team file, the calendar year from the old files.
  get currentSeasonID() {
    return this.store.seasonID;
  }

  get currentSeasonLabel() {
    return this.store.label;
  }

  get currentSeasonData() {
    return this.store.season;
  }

  get currentSeasonRecord() {
    return this.store.games;
  }

  set currentSeasonRecord(arry) {
    this.store.games = arry;
  }

  get seasonRecordDraftID() {
    return this.store.seasonRecordDraftID;
  }

  // Week 1 of the practice-plan counter. A season without its own start
  // date falls back to the team's in teams.yaml.
  get startDate() {
    const seasonStart = this.store.startDate;
    return seasonStart != undefined ? seasonStart : this.team.startDate;
  }

  get gblTmplSettings() {
    return this.team.gblTmplSettings;
  }

  get tmplSettingsSeasonRecord() {
    if (typeof TmplSettings == "undefined") require("modules/bvr/utils/TmplSettings.js");
    return new TmplSettings(
      this.gblTmplSettings,
      this.#tmplSettings?.seasonRecord,
    );
  }

  // **********************
  // Public Functions
  // **********************

  // True when there is a season to record into. Otherwise says to run Start
  // New Season and returns false. Callers check before any prompt appears.
  // The old files always have one: the calendar year.
  ensureCurrentSeason() {
    if (this.currentSeasonData != undefined) return true;

    this.ui.displayAppMessage(
      "error",
      `${this.teamName} has no current season. Run Start New Season first.`,
    );
    return false;
  }

  // The current season's link for a form. Looks in the season's own
  // formURLs (an override), then the term's shared link, then asks. A link
  // given at the prompt is saved for the whole term when the season has
  // one, else on the season. Returns undefined if none is given.
  ensureFormURL(formName) {
    if (this.usesTeamFile) this.#liftSeasonLinks(this.currentSeasonID, this.currentSeasonData);

    const effective = this.#effectiveLink(formName, this.store.formURLs, this.term);
    if (effective.url) return effective.url;

    const url = this.#promptForFormURL(formName);
    if (url == undefined) return undefined;
    if (this.term == undefined) {
      this.store.saveFormURL(formName, url);
    } else {
      this.formLinks.setLink(this.term, formName, url);
      this.formLinks.save();
    }
    return url;
  }

  updateWith(game) {
    if (game == undefined) {
      return this.ui.displayAppMessage("error", "Game data missing!");
    }
    if (!this.ensureCurrentSeason()) return;
    game.appended = this.#appendToRecordsDraft(game);
    this.#saveRecordsData(game);
  }

  // Save an edited game, then rewrite the season record draft's table, and
  // the record in its title, from this season's games: one row per recorded
  // game, in games[] order (the
  // order rows were appended). The table is rebuilt rather than patched
  // because the draft is never edited by hand. oldRow is the edited game's
  // row before the edit, which is expected to go; removing any other row is
  // asked about first. Returns "rebuilt", "declined", "missing" (no record
  // draft), or "noTable". The game is saved whatever happens to the draft.
  rebuildRecordWith(game, oldRow) {
    if (game == undefined) {
      return this.ui.displayAppMessage("error", "Game data missing!");
    }
    if (!this.ensureCurrentSeason()) return undefined;
    const outcome = this.#rebuildRecordsDraft(game, oldRow);
    this.#saveRecordsData(game);
    return outcome;
  }

  // A game's season record row, rendered from game-record-row.md.
  recordRow(game) {
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    return new Template(game.tmplSettingsRecordRow).content;
  }

  // A team with history in the old files but no team file keeps the old
  // behavior until it is migrated. Every other team gets a new season in its
  // team file, which is created here for a team with no history at all.
  startNewSeason() {
    if (!this.usesTeamFile && this.store.hasTeamData) return this.#startLegacySeason();
    return this.#startTeamFileSeason();
  }

  // Change the current season's name, dates, or form links in one prompt,
  // and save once. Team files only: the old files have nowhere to keep them.
  editCurrentSeason() {
    if (!this.usesTeamFile) {
      return this.ui.displayAppMessage(
        "info",
        `${this.teamName} still uses records.json. Run bun run bvr:migrate first, then edit its season.`,
      );
    }
    if (!this.ensureCurrentSeason()) return;

    const entry = this.currentSeasonData;
    this.#liftSeasonLinks(this.currentSeasonID, entry);
    const answers = this.#askSeasonEdits(entry);
    if (answers == undefined) return;

    const changes = this.#seasonEdits(entry, answers);
    const plans = entry.practicePlans || {};
    if (changes.startDate != undefined && Object.keys(plans).length > 0 && !this.#confirmStartDateChange()) {
      return this.ui.displayAppMessage("info", "Nothing was changed.");
    }
    if (changes.clearedForms.length > 0 && !this.#confirmClearLinks(changes.clearedForms)) {
      changes.clearedForms = [];
    }

    const { changed, seasonChanged, sharedChanged } = this.#applySeasonEdits(entry, changes);
    const roster = answers.newRoster ? this.#createAttendanceDraft(this.currentSeasonLabel) : undefined;
    if (roster != undefined) {
      entry.attendanceDraftID = roster.draftID;
      changed.push("roster draft");
    }
    if (changed.length == 0) return this.ui.displayAppMessage("info", "Nothing changed.");

    if (sharedChanged) this.formLinks.save();
    if (seasonChanged || roster != undefined) this.store.saveGames();
    if (roster != undefined) this.bvr.pinDraft(roster.draft);
    this.ui.displayAppMessage("success", `Updated ${this.currentSeasonLabel}: ${changed.join(", ")}.`);
  }

  // Show the Edit Season prompt, asking again (up to three times, with what
  // was typed) while the recipient lists name unknown initials.
  #askSeasonEdits(entry) {
    let previous;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const answers = this.#showEditSeasonPrompt(entry, previous);
      if (answers == undefined) return undefined;
      if (!this.#reportUnknownInitials(this.#typedRecipients(answers))) return answers;
      previous = answers;
    }
    return undefined;
  }

  // **********************
  // Private Functions
  // **********************

  // One prompt, prefilled from the season. The last day is a date picker plus
  // a switch, because a Drafts date picker cannot be left empty: the switch
  // off means no last day (endDate null).
  // previous: the answers from an attempt being asked again, which prefill
  // every field in place of the season's values.
  #showEditSeasonPrompt(entry, previous) {
    const section = JSON.parse(JSON.stringify(this.ui.settings("editSeason")));
    const {
      menuSettings, labelField, startDateField, hasEndDateField, endDateField, formField,
      attendanceField, gameReportField, rosterLabel, newRosterField,
    } = section;
    const startDate = this.#parseYMD(entry.startDate) || new Date();
    const overrides = entry.recipients || {};
    const defaults = this.team.defaultRecipients;

    labelField.data.initialText = previous ? previous.label : this.currentSeasonLabel;
    startDateField.data.initialDate = previous ? previous.startDate : startDate;
    hasEndDateField.data.initialValue = previous ? previous.hasEndDate : entry.endDate != undefined;
    endDateField.data.initialDate = previous ? previous.endDate : this.#parseYMD(entry.endDate) || startDate;
    const formFields = this.team.formNames.map((formName) => {
      const effective = this.#effectiveLink(formName, entry.formURLs, this.term);
      const title = this.#formTitle(formName);
      const label = effective.source == "term" ? `${title} (shared for ${this.#termLabel(this.term)})` : title;
      const typed = previous?.[`form:${formName}`];
      return {
        ...JSON.parse(JSON.stringify(formField)),
        data: { ...formField.data, name: `form:${formName}`, label, initialText: previous ? typed : effective.url || "" },
      };
    });
    const recipientField = (field, key) => {
      if (!overrides[key]) field.data.label = `${field.data.label} (team default)`;
      field.data.initialText = previous ? previous[key] : (overrides[key] || defaults[key]).join(", ");
      return field;
    };
    rosterLabel.data.label = entry.attendanceDraftID
      ? `Roster draft: ${this.#draftTitle(entry.attendanceDraftID)}`
      : "This season has no roster draft yet.";
    newRosterField.data.initialValue = previous ? previous.newRoster : false;
    menuSettings.menuItems.push(
      labelField, startDateField, hasEndDateField, endDateField, ...formFields,
      recipientField(attendanceField, "attendance"), recipientField(gameReportField, "gameReport"),
      rosterLabel, newRosterField,
    );

    const seasonPrompt = this.ui.buildMenu(menuSettings);
    if (seasonPrompt.show() == false) return undefined;
    return seasonPrompt.fieldValues;
  }

  // What the answers would change: new values for label and dates, links to
  // set, and forms whose saved link was blanked (cleared only on a yes).
  #seasonEdits(entry, answers) {
    if (typeof GoogleForm == "undefined") require("modules/bvr/services/GoogleForm.js");
    const edits = { links: {}, clearedForms: [] };

    const label = `${answers.label || ""}`.trim();
    if (label != "" && label != entry.label) edits.label = label;

    const startDate = this.bvr.formatDateYMD(answers.startDate);
    if (startDate != entry.startDate) edits.startDate = startDate;

    const endDate = answers.hasEndDate ? this.bvr.formatDateYMD(answers.endDate) : null;
    if (endDate != (entry.endDate == undefined ? null : entry.endDate)) edits.endDate = endDate;

    const recipients = this.#recipientOverrides(this.#typedRecipients(answers));
    const savedRecipients = entry.recipients == undefined ? null : entry.recipients;
    if (JSON.stringify(recipients) != JSON.stringify(savedRecipients)) edits.recipients = recipients;

    for (const formName of this.team.formNames) {
      const effective = this.#effectiveLink(formName, entry.formURLs, this.term);
      const typed = `${answers[`form:${formName}`] || ""}`.trim();
      if (typed == "") {
        if (effective.url) edits.clearedForms.push(formName);
        continue;
      }
      const url = GoogleForm.baseURL(typed);
      if (url == undefined) {
        this.ui.displayAppMessage("info", `The ${this.#formTitle(formName)} link is not a link, so it was left as it was.`);
      } else if (url != effective.url) {
        edits.links[formName] = url;
      }
    }
    return edits;
  }

  // Write the edits into the season entry and the shared links. A new link
  // replaces whichever one was in effect: the season's own override if it
  // has one, else the term's shared link (so every team in the term gets
  // it), else the season's. A confirmed clear removes both. Returns the
  // names of what changed and which files need saving.
  #applySeasonEdits(entry, edits) {
    const changed = [];
    let seasonChanged = false;
    let sharedChanged = false;
    const term = this.term;
    if (edits.label != undefined) {
      entry.label = edits.label;
      changed.push("name");
    }
    if (edits.startDate != undefined) {
      entry.startDate = edits.startDate;
      changed.push("first day");
    }
    if (edits.endDate !== undefined) {
      entry.endDate = edits.endDate;
      changed.push("last day");
    }
    if (edits.recipients !== undefined) {
      entry.recipients = edits.recipients;
      changed.push("recipients");
    }
    seasonChanged = changed.length > 0;

    const formURLs = { ...(entry.formURLs || {}) };
    for (const [formName, url] of Object.entries(edits.links)) {
      if (formURLs[formName] || term == undefined) {
        formURLs[formName] = url;
        seasonChanged = true;
        changed.push(`${this.#formTitle(formName)} link`);
      } else {
        this.formLinks.setLink(term, formName, url);
        sharedChanged = true;
        changed.push(`${this.#formTitle(formName)} link (shared)`);
      }
    }
    for (const formName of edits.clearedForms) {
      if (formURLs[formName]) {
        delete formURLs[formName];
        seasonChanged = true;
      }
      if (term != undefined && this.formLinks.link(term, formName)) {
        this.formLinks.clearLink(term, formName);
        sharedChanged = true;
      }
      changed.push(`${this.#formTitle(formName)} link`);
    }
    if (seasonChanged) {
      entry.formURLs = formURLs;
      if (entry.formURL === null) delete entry.formURL;
    }
    return { changed, seasonChanged, sharedChanged };
  }

  // The link in effect for a form, and where it comes from: the season's
  // own formURLs ("season"), the term's shared links ("term"), or nowhere.
  #effectiveLink(formName, seasonURLs, term) {
    const own = (seasonURLs || {})[formName];
    if (own) return { url: own, source: "season" };
    const shared = term == undefined ? undefined : this.formLinks.link(term, formName);
    if (shared) return { url: shared, source: "term" };
    return { url: undefined, source: undefined };
  }

  // Links saved on a season before links were shared per term move up to
  // the term's shared entry when the term has none for that form, and are
  // removed from the season (one save each). A season link that differs
  // from an existing shared one stays, as an override.
  #liftSeasonLinks(seasonID, entry) {
    if (typeof FormLinkStore == "undefined") require("modules/bvr/storage/FormLinkStore.js");
    const term = FormLinkStore.termFor(seasonID);
    const seasonURLs = entry?.formURLs || {};
    if (term == undefined || Object.keys(seasonURLs).length == 0) return;

    const lifted = Object.keys(seasonURLs).filter((formName) => {
      const shared = this.formLinks.link(term, formName);
      if (shared == undefined) this.formLinks.setLink(term, formName, seasonURLs[formName]);
      return shared == undefined || shared == seasonURLs[formName];
    });
    if (lifted.length == 0) return;

    const remaining = { ...seasonURLs };
    lifted.forEach((formName) => delete remaining[formName]);
    this.formLinks.save();
    entry.formURLs = remaining;
    this.store.saveGames();
  }

  #termLabel(term) {
    if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
    return TeamFileStore.seasonLabel(term);
  }

  #confirmStartDateChange() {
    const { startDateWarning } = this.ui.settings("editSeason");
    return this.ui.yesNoPrompt({ ...startDateWarning }) == "yes";
  }

  #confirmClearLinks(formNames) {
    const { clearLinksPrompt } = this.ui.settings("editSeason");
    const titles = formNames.map((formName) => this.#formTitle(formName)).join(", ");
    return this.ui.yesNoPrompt({ ...clearLinksPrompt, menuMessage: `${clearLinksPrompt.menuMessage}\n\n${titles}` }) == "yes";
  }

  #formTitle(formName) {
    return this.team.form(formName).title || formName;
  }

  // "2026-09-07" as a local date (new Date("2026-09-07") would be UTC
  // midnight, the day before in US time zones). Undefined for no date.
  #parseYMD(value) {
    if (!value) return undefined;
    const [year, month, day] = `${value}`.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  // The team file when there is one. A team file that exists but cannot be
  // read stops the action: falling back to records.json would hide its games,
  // and writing would overwrite them.
  #selectStore() {
    if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
    let teamFile;
    try {
      teamFile = TeamFileStore.load(this.teamFilePath);
    } catch (error) {
      const message = `${error.message}. Nothing was changed. If iCloud is still syncing, wait and try again; otherwise restore it from ~/Backups/drafts-bvr.`;
      this.ui.displayAppMessage("error", message);
      throw new Error(message);
    }
    if (teamFile != undefined) return teamFile;

    this.ui.displayAppMessage(
      "info",
      `${this.teamName} has not been migrated to a team file yet. Using records.json.`,
    );
    return this.#legacyStore();
  }

  #legacyStore() {
    if (typeof LegacySeasonStore == "undefined") require("modules/bvr/storage/LegacySeasonStore.js");
    return new LegacySeasonStore({
      teamID: this.teamID,
      year: new Date().getFullYear(),
      startDate: this.team.startDate,
      loadRecords: () => {
        if (typeof DataFile == "undefined") require("modules/cp/filesystems/CloudFS.js");
        return new DataFile(this.recordsFile);
      },
      loadPracticePlans: () => this.bvr.ppData,
    });
  }

  // Old files: give this calendar year a season record draft, as before.
  #startLegacySeason() {
    if (this.seasonRecordDraftID != undefined) {
      return this.ui.displayAppMessage(
        "info",
        `${this.teamName} already has a season record draft for ${this.currentSeasonID}.`,
      );
    }
    this.#createSeasonRecordDraft();
  }

  // Team file: prompt for the season, add it, make it current, and give it a
  // season record draft. A season that already exists is completed instead.
  #startTeamFileSeason() {
    if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
    const details = this.#promptForNewSeason();
    if (details == undefined) return;

    if (this.usesTeamFile && this.store.hasSeason(details.seasonID)) {
      return this.#completeExistingSeason(details);
    }
    // The roster draft in use now, before the new season becomes current.
    const rosterBefore = this.team.attendanceDraftID;
    if (!this.usesTeamFile) {
      this.store = TeamFileStore.create(this.teamFilePath, this.teamID);
    }

    // Each step asks for one thing: form links the term lacks, then who gets
    // messages, then (after the season exists) the roster draft.
    const label = TeamFileStore.seasonLabel(details.seasonID);
    const formURLs = this.#promptForMissingLinks(details.seasonID, {}, label);
    const recipients = this.#promptForRecipients(this.team.defaultRecipients);
    this.store.addSeason(details.seasonID, {
      startDate: details.startDate,
      formURLs,
      recipients: recipients == undefined ? null : recipients,
    });
    this.store.setCurrentSeason(details.seasonID);
    this.#createSeasonRecordDraft();
    this.#settleAttendanceDraft(this.store.seasonFor(details.seasonID), rosterBefore, label);
  }

  // A season can exist without a record draft: bvr:migrate creates the
  // teams.yaml season before its first game. Make it current, keep its own
  // start date (or take the prompted one), and create the draft it lacks.
  // Only a season that already has a draft is reported as existing.
  #completeExistingSeason({ seasonID, startDate }) {
    const entry = this.store.seasonFor(seasonID);
    const wasCurrent = this.currentSeasonID == seasonID;
    const hadDraft = Boolean(entry.seasonRecordDraftID);
    const filledStartDate = !entry.startDate;
    this.#liftSeasonLinks(seasonID, entry);
    const savedURLs = entry.formURLs || {};
    const newURLs = this.#promptForMissingLinks(seasonID, savedURLs, entry.label || seasonID);
    const addedURLs = Object.keys(newURLs).length > 0;

    if (filledStartDate) entry.startDate = startDate;
    if (addedURLs) entry.formURLs = { ...savedURLs, ...newURLs };
    const rosterBefore = this.team.attendanceDraftID;
    const needsRoster = !entry.attendanceDraftID;
    this.store.setCurrentSeason(seasonID);
    if (!hadDraft) this.#createSeasonRecordDraft();
    if (needsRoster) this.#settleAttendanceDraft(entry, rosterBefore, entry.label || seasonID);
    if (!hadDraft || needsRoster) return;

    if (!wasCurrent || filledStartDate || addedURLs) this.store.saveGames();
    const message = wasCurrent
      ? `${this.teamName} already has a ${seasonID} season.`
      : `${seasonID} is now the current season. It already had a season record draft.`;
    return this.ui.displayAppMessage("info", message);
  }

  // Ask who gets attendance and score messages, prefilled with the lists in
  // effect (comma-separated initials). Unknown initials are named and the
  // prompt asked again, up to three times. Returns the lists that differ
  // from the team default, null when none do (so level changes still flow
  // through), or undefined when cancelled.
  #promptForRecipients(current) {
    let lists = current;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const section = JSON.parse(JSON.stringify(this.ui.settings("recipientsPrompt")));
      const { menuSettings, attendanceField, gameReportField } = section;
      attendanceField.data.initialText = lists.attendance.join(", ");
      gameReportField.data.initialText = lists.gameReport.join(", ");
      menuSettings.menuItems.push(attendanceField, gameReportField);

      const recipientsPrompt = this.ui.buildMenu(menuSettings);
      if (recipientsPrompt.show() == false) return undefined;

      lists = this.#typedRecipients(recipientsPrompt.fieldValues);
      if (this.#reportUnknownInitials(lists)) continue;
      return this.#recipientOverrides(lists);
    }
    return undefined;
  }

  // The two lists typed into a prompt. A blank field means the team default.
  #typedRecipients(fieldValues) {
    if (typeof Staff == "undefined") require("modules/bvr/utils/Staff.js");
    const defaults = this.team.defaultRecipients;
    const parse = (text, fallback) => {
      const initials = Staff.parseInitials(text);
      return initials.length > 0 ? initials : fallback;
    };
    return {
      attendance: parse(fieldValues.attendance, defaults.attendance),
      gameReport: parse(fieldValues.gameReport, defaults.gameReport),
    };
  }

  // Shows which initials staff.yaml.tpl does not know. True if there were any.
  #reportUnknownInitials(lists) {
    const unknown = this.bvr.staff.unknown([...new Set([...lists.attendance, ...lists.gameReport])]);
    if (unknown.length == 0) return false;
    this.ui.displayAppMessage("info", `No one in staff.yaml.tpl has the initials ${unknown.join(", ")}. Check them and try again.`);
    return true;
  }

  // Only the lists that differ from the team default (order does not
  // matter), or null when both match it.
  #recipientOverrides(lists) {
    const defaults = this.team.defaultRecipients;
    const same = (a, b) => a.length == b.length && a.every((initials) => b.includes(initials));
    const overrides = {};
    if (!same(lists.attendance, defaults.attendance)) overrides.attendance = lists.attendance;
    if (!same(lists.gameReport, defaults.gameReport)) overrides.gameReport = lists.gameReport;
    return Object.keys(overrides).length > 0 ? overrides : null;
  }

  // Give a season its roster draft: keep the one in use (rosterBefore) or
  // start a new one, asking first when there is one to keep. A new draft is
  // opened in the editor for the roster to be typed. Saves the season.
  #settleAttendanceDraft(entry, rosterBefore, seasonLabel) {
    const keep = rosterBefore && this.#askKeepRoster(rosterBefore, seasonLabel);
    if (keep) {
      entry.attendanceDraftID = rosterBefore;
      this.store.saveGames();
      return;
    }

    const roster = this.#createAttendanceDraft(seasonLabel);
    entry.attendanceDraftID = roster.draftID;
    this.store.saveGames();
    this.bvr.pinDraft(roster.draft);
    this.ui.displayAppMessage(
      "success",
      `Roster draft for ${seasonLabel} created and opened. Add the players; next season, keep it and run Update Roster to move everyone up a grade.`,
    );
  }

  // True to keep the current roster draft. Keep is the default, and so is
  // cancelling, so nothing is created by accident. The question is ui.yaml's,
  // with [[roster]] and [[season]] filled in.
  #askKeepRoster(draftID, seasonLabel) {
    const section = JSON.parse(JSON.stringify(this.ui.settings("attendanceDraftPrompt")));
    const { menuSettings } = section;
    menuSettings.menuMessage = menuSettings.menuMessage
      .replace("[[roster]]", () => this.#draftTitle(draftID))
      .replace("[[season]]", () => seasonLabel);
    const rosterPrompt = this.ui.buildMenu(menuSettings);
    if (rosterPrompt.show() == false) return true;
    return rosterPrompt.buttonPressed != "new";
  }

  // A new roster draft from the team's attendance template, tagged for the
  // team. Its title names the team and season (Team.rosterTitle, which Update
  // Roster compares); the template's [[date]] tag fills in the "_For:" line.
  #createAttendanceDraft(seasonLabel) {
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    const { templateFile } = this.#tmplSettings.attendance;
    const roster = new Template({
      templateFile,
      draftTags: this.defaultDraftTags,
      templateTags: { team_abbr: this.team.abbr, season_label: seasonLabel },
    });
    roster.save();
    return roster;
  }

  #draftTitle(draftID) {
    const found = typeof Draft == "undefined" ? undefined : Draft.find(draftID);
    return found?.displayTitle || "the current roster draft";
  }

  // Ask for the links neither the season nor its term has. With a term, the
  // links given are saved to the shared entry here and nothing is returned;
  // without one, they are returned for the season entry.
  #promptForMissingLinks(seasonID, seasonURLs, seasonLabel) {
    if (typeof FormLinkStore == "undefined") require("modules/bvr/storage/FormLinkStore.js");
    const term = FormLinkStore.termFor(seasonID);
    const missing = this.team.formNames.filter((formName) => !this.#effectiveLink(formName, seasonURLs, term).url);
    const given = this.#promptForFormURLs(missing, seasonLabel);
    if (term == undefined) return given;

    if (Object.keys(given).length > 0) {
      Object.entries(given).forEach(([formName, url]) => this.formLinks.setLink(term, formName, url));
      this.formLinks.save();
    }
    return {};
  }

  // Ask for each form's link in turn. Returns { <form name>: link } for the
  // ones given; blanks are left out, to be asked for at Submit Game Report.
  #promptForFormURLs(formNames, seasonLabel) {
    const formURLs = {};
    for (const formName of formNames) {
      const url = this.#promptForFormURL(formName, seasonLabel);
      if (url != undefined) formURLs[formName] = url;
    }
    return formURLs;
  }

  // Ask for the link to one score form, for a season. Blank skips it;
  // something that is not a link is reported and skipped.
  #promptForFormURL(formName, seasonLabel = this.currentSeasonLabel) {
    if (typeof GoogleForm == "undefined") require("modules/bvr/services/GoogleForm.js");
    const section = JSON.parse(JSON.stringify(this.ui.settings("formURLPrompt")));
    const { menuSettings, urlField } = section;
    const title = this.#formTitle(formName);
    menuSettings.menuMessage = `${menuSettings.menuMessage}\n\n${title}, ${seasonLabel}`;
    menuSettings.menuItems.push(urlField);

    const urlPrompt = this.ui.buildMenu(menuSettings);
    if (urlPrompt.show() == false) return undefined;

    const pasted = `${urlPrompt.fieldValues[urlField.data.name] || ""}`.trim();
    if (pasted == "") return undefined;

    const url = GoogleForm.baseURL(pasted);
    if (url == undefined) {
      this.ui.displayAppMessage("info", `That is not a link, so the ${title} link was not saved.`);
    }
    return url;
  }

  // Ask for the new season's ID and start date, asking again (up to three
  // times) when the ID is not <year>-<name>. Returns undefined if the prompt
  // is cancelled or no valid ID is given.
  #promptForNewSeason() {
    let seasonID = this.#defaultNewSeasonID();
    for (let attempt = 1; attempt <= 3; attempt++) {
      const answer = this.#showNewSeasonPrompt(seasonID);
      if (answer == undefined) return undefined;
      if (TeamFileStore.isValidSeasonID(answer.seasonID)) return answer;

      seasonID = answer.seasonID;
      this.ui.displayAppMessage(
        "info",
        `"${seasonID}" is not a season name. Start with the year, then a name: 2026-winter or 2026-27.`,
      );
    }
    return undefined;
  }

  // ui.settings() hands back the same object every time, so each attempt
  // works on a copy; pushing into the shared one would repeat the fields.
  #showNewSeasonPrompt(initialSeasonID) {
    const section = JSON.parse(JSON.stringify(this.ui.settings("startNewSeason")));
    const { menuSettings, seasonIDField, startDateField } = section;
    seasonIDField.data.initialText = initialSeasonID;
    startDateField.data.initialDate = this.#comingMonday();
    menuSettings.menuItems.push(seasonIDField, startDateField);

    const seasonPrompt = this.ui.buildMenu(menuSettings);
    if (seasonPrompt.show() == false) return undefined;

    const seasonID = `${seasonPrompt.fieldValues[seasonIDField.data.name] || ""}`.trim();
    const startDate = seasonPrompt.fieldValues[startDateField.data.name];
    return { seasonID, startDate: this.bvr.formatDateYMD(startDate) };
  }

  // "<year>-<season>" from teams.yaml, e.g. 2026-fall. Any name is accepted
  // at the prompt, so a winter sport can use 2026-winter or 2026-27.
  #defaultNewSeasonID() {
    const year = new Date().getFullYear();
    const seasonName = this.team.seasonName;
    return seasonName ? `${year}-${seasonName}` : `${year}`;
  }

  // Today if it is a Monday, otherwise the next Monday.
  #comingMonday(today = new Date()) {
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysAhead = (8 - monday.getDay()) % 7;
    monday.setDate(monday.getDate() + daysAhead);
    return monday;
  }

  #createSeasonRecordDraft() {
    if (typeof Template == "undefined") require("modules/cp/templates/Template.js");
    const seasonRecordDraft = new Template(this.tmplSettingsSeasonRecord);
    seasonRecordDraft.archive().save();

    this.store.seasonRecordDraftID = seasonRecordDraft.draftID;
    this.store.saveGames();

    return this.ui.displayAppMessage("success", "Season record draft created.");
  }

  #appendToRecordsDraft(game) {
    if (game.appended == true) return true;
    if (
      this.seasonRecordDraftID == undefined ||
      game.tmplSettingsRecordRow == undefined
    ) {
      this.ui.displayAppMessage("error", "Game could not be appended.");
      return false;
    }

    if (typeof SeasonRecordTable == "undefined") require("modules/bvr/utils/SeasonRecordTable.js");
    if (this.recordsDraft == undefined) {
      this.recordsDraft = Draft.find(this.seasonRecordDraftID);
    }

    this.recordsDraft.append(this.recordRow(game));
    const tally = SeasonRecordTable.tally(this.#gamesWith(game));
    this.recordsDraft.content = SeasonRecordTable.withTally(this.recordsDraft.content.split("\n"), tally).join("\n");
    this.recordsDraft.update();
    return true;
  }

  // Rewrite the record draft's rows from games[] (see rebuildRecordWith).
  // Every game written gets appended = true; nothing is marked when the
  // draft is left alone.
  #rebuildRecordsDraft(game, oldRow) {
    if (typeof SeasonRecordTable == "undefined") require("modules/bvr/utils/SeasonRecordTable.js");
    const recordsDraft = this.#findRecordsDraft();
    if (recordsDraft == undefined) return "missing";

    const written = this.#recordedGames(game);
    const rows = written.map(({ game: rowGame }) => this.recordRow(rowGame));
    const rebuilt = SeasonRecordTable.rebuild(recordsDraft.content.split("\n"), rows, [oldRow]);
    if (rebuilt == undefined) return "noTable";
    if (rebuilt.vanished.length > 0 && !this.#confirmRemoveRows(rebuilt.vanished)) return "declined";

    const tally = SeasonRecordTable.tally(written.map(({ game: rowGame }) => rowGame));
    recordsDraft.content = SeasonRecordTable.withTally(rebuilt.lines, tally).join("\n");
    recordsDraft.update();
    written.forEach(({ entry, game: rowGame }) => {
      entry.appended = true;
      rowGame.appended = true;
    });
    return "rebuilt";
  }

  // The season's recorded games in games[] order, each with its stored
  // entry and a Game to render it. The edited game is used as given, so
  // its row shows the edit.
  #recordedGames(editedGame) {
    if (typeof Game == "undefined") require("modules/bvr/core/Game.js");
    return this.currentSeasonRecord
      .map((entry) => {
        const isEdited = entry.draftID != undefined && entry.draftID == editedGame.draftID;
        return { entry, game: isEdited ? editedGame : Game.fromJSON(this.#dependencies, entry) };
      })
      .filter(({ game }) => game.recorded);
  }

  // The season record draft, as the global draft when it is the open one
  // (see docs/reference/drafts-runtime.md). Undefined when there is none.
  #findRecordsDraft() {
    const draftID = this.seasonRecordDraftID;
    if (draftID == undefined) return undefined;
    if (typeof draft != "undefined" && draft.uuid == draftID) return draft;
    return Draft.find(draftID);
  }

  // Ask before a rebuild drops rows that no game in the team file accounts
  // for, listing them. True on a yes.
  #confirmRemoveRows(rows) {
    const { removeRowsPrompt } = this.ui.settings("editGame");
    const count = rows.length == 1 ? "1 row" : `${rows.length} rows`;
    const menuMessage = `${removeRowsPrompt.menuMessage}\n\n${count}:\n${rows.join("\n")}`;
    return this.ui.yesNoPrompt({ ...removeRowsPrompt, menuMessage }) == "yes";
  }

  #saveRecordsData(game) {
    if (game == undefined) {
      return this.ui.displayAppMessage(
        "error",
        "Season record could not be saved.",
      );
    }

    this.currentSeasonRecord = this.#gamesWith(game);
    this.store.saveGames();
  }

  // This season's games with game in them: in place of its entry, or added
  // at the end when it is new. The stored games are not changed.
  #gamesWith(game) {
    const games = this.currentSeasonRecord;
    const index = games.findIndex((recordItem) => recordItem.draftID == game.draftID);
    if (index == -1) return [...games, game.toJSON()];
    return games.map((recordItem, i) => (i == index ? game.toJSON() : recordItem));
  }
}
