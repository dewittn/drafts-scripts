if (typeof SeasonSetup == "undefined") require("modules/bvr/core/SeasonSetup.js");
if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
if (typeof TeamConfig == "undefined") require("modules/bvr/utils/TeamConfig.js");
if (typeof BVRUtilities == "undefined") require("modules/bvr/utils/BVRUtilities.js");
if (typeof GoogleForm == "undefined") require("modules/bvr/services/GoogleForm.js");

// Edit Season: change the current season's name, dates, form links,
// recipients, or roster draft in one prompt, and save once. Team files only;
// the old files have nowhere to keep them. Season.editCurrentSeason() runs it.
class SeasonEditor {
  #season;
  #setup;

  // season: the team's Season. setup: the SeasonSetup whose roster draft,
  // unknown-initials check, and retries Edit Season reuses.
  constructor(season, setup) {
    this.#season = season;
    this.#setup = setup;
  }

  get #ui() {
    return this.#season.ui;
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

  edit() {
    const season = this.#season;
    if (!season.usesTeamFile) {
      return this.#ui.displayAppMessage(
        "info",
        `${season.teamName} still uses records.json. Run bun run bvr:migrate first, then edit its season.`,
      );
    }
    if (!season.ensureCurrentSeason()) return;

    const entry = season.currentSeasonData;
    this.#links.liftSeasonLinks(season.currentSeasonID);
    const answers = this.#askSeasonEdits(entry);
    if (answers == undefined) return;

    const changes = this.#seasonEdits(entry, answers);
    const plans = entry.practicePlans || {};
    if (changes.startDate != undefined && Object.keys(plans).length > 0 && !this.#confirmStartDateChange()) {
      return this.#ui.displayAppMessage("info", "Nothing was changed.");
    }
    if (changes.clearedForms.length > 0 && !this.#confirmClearLinks(changes.clearedForms)) {
      changes.clearedForms = [];
    }

    // Applied before the roster draft is made, so a new name is its title.
    const { changed, seasonChanged, sharedChanged } = this.#applySeasonEdits(entry, changes);
    const roster = answers.newRoster ? this.#setup.createAttendanceDraft(season.currentSeasonLabel) : undefined;
    if (roster != undefined) {
      this.#store.updateSeason(season.currentSeasonID, { attendanceDraftID: roster.draftID });
      changed.push("roster draft");
    }
    if (changed.length == 0) return this.#ui.displayAppMessage("info", "Nothing changed.");

    if (sharedChanged) season.formLinks.save();
    if (seasonChanged || roster != undefined) this.#store.save();
    if (roster != undefined) season.bvr.pinDraft(roster.draft);
    this.#ui.displayAppMessage("success", `Updated ${season.currentSeasonLabel}: ${changed.join(", ")}.`);
  }

  // **********************
  // Prompt
  // **********************

  // Asked again, with what was typed, while the recipient lists name
  // unknown initials.
  #askSeasonEdits(entry) {
    const defaults = this.#team.defaultRecipients;
    return SeasonSetup.askUpToThreeTimes(
      (previous) => this.#showEditSeasonPrompt(entry, previous),
      (answers) => !this.#setup.reportUnknownInitials(TeamConfig.typedRecipients(answers, defaults)),
    );
  }

  // Prefilled from the season, or from previous when asked again. A Drafts date
  // picker cannot be left empty, so a switch decides the last day (off: null).
  #showEditSeasonPrompt(entry, previous) {
    const section = this.#ui.settingsCopy("editSeason");
    const {
      menuSettings, labelField, startDateField, hasEndDateField, endDateField, formField,
      attendanceField, gameReportField, rosterLabel, newRosterField,
    } = section;
    const startDate = BVRUtilities.parseDateYMD(entry.startDate) || new Date();
    const overrides = entry.recipients || {};
    const defaults = this.#team.defaultRecipients;
    const term = this.#season.term;

    labelField.data.initialText = previous ? previous.label : this.#season.currentSeasonLabel;
    startDateField.data.initialDate = previous ? previous.startDate : startDate;
    hasEndDateField.data.initialValue = previous ? previous.hasEndDate : entry.endDate != undefined;
    endDateField.data.initialDate = previous ? previous.endDate : BVRUtilities.parseDateYMD(entry.endDate) || startDate;
    const formFields = this.#team.formNames.map((formName) => {
      const effective = this.#links.effective(formName, entry.formURLs, term);
      const title = this.#season.formTitle(formName);
      const label = effective.source == "term" ? `${title} (shared for ${this.#termLabel(term)})` : title;
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
      ? `Roster draft: ${this.#setup.draftTitle(entry.attendanceDraftID)}`
      : "This season has no roster draft yet.";
    newRosterField.data.initialValue = previous ? previous.newRoster : false;
    menuSettings.menuItems.push(
      labelField, startDateField, hasEndDateField, endDateField, ...formFields,
      recipientField(attendanceField, "attendance"), recipientField(gameReportField, "gameReport"),
      rosterLabel, newRosterField,
    );

    const seasonPrompt = this.#ui.buildMenu(menuSettings);
    if (seasonPrompt.show() == false) return undefined;
    return seasonPrompt.fieldValues;
  }

  #confirmStartDateChange() {
    const { startDateWarning } = this.#ui.settings("editSeason");
    return this.#ui.yesNoPrompt({ ...startDateWarning }) == "yes";
  }

  #confirmClearLinks(formNames) {
    const { clearLinksPrompt } = this.#ui.settings("editSeason");
    const titles = formNames.map((formName) => this.#season.formTitle(formName)).join(", ");
    return this.#ui.yesNoPrompt({ ...clearLinksPrompt, menuMessage: `${clearLinksPrompt.menuMessage}\n\n${titles}` }) == "yes";
  }

  #termLabel(term) {
    return TeamFileStore.seasonLabel(term);
  }

  // **********************
  // Changes
  // **********************

  // What the answers would change: new label, dates, and recipients, links
  // to set, and forms whose link was blanked (cleared only on a yes).
  #seasonEdits(entry, answers) {
    const edits = { links: {}, clearedForms: [] };

    const label = `${answers.label || ""}`.trim();
    if (label != "" && label != entry.label) edits.label = label;

    const startDate = this.#season.bvr.formatDateYMD(answers.startDate);
    if (startDate != entry.startDate) edits.startDate = startDate;

    const endDate = answers.hasEndDate ? this.#season.bvr.formatDateYMD(answers.endDate) : null;
    if (endDate != (entry.endDate == undefined ? null : entry.endDate)) edits.endDate = endDate;

    const defaults = this.#team.defaultRecipients;
    const recipients = TeamConfig.recipientOverrides(TeamConfig.typedRecipients(answers, defaults), defaults);
    const savedRecipients = entry.recipients == undefined ? null : entry.recipients;
    if (JSON.stringify(recipients) != JSON.stringify(savedRecipients)) edits.recipients = recipients;

    const term = this.#season.term;
    for (const formName of this.#team.formNames) {
      const effective = this.#links.effective(formName, entry.formURLs, term);
      const typed = `${answers[`form:${formName}`] || ""}`.trim();
      if (typed == "") {
        if (effective.url) edits.clearedForms.push(formName);
        continue;
      }
      const url = GoogleForm.baseURL(typed);
      if (url == undefined) {
        this.#ui.displayAppMessage("info", `The ${this.#season.formTitle(formName)} link is not a link, so it was left as it was.`);
      } else if (url != effective.url) {
        edits.links[formName] = url;
      }
    }
    return edits;
  }

  // Apply the edits through the store and the shared links; a confirmed clear
  // removes a link from both. Returns what changed and which files to save.
  #applySeasonEdits(entry, edits) {
    const changed = [];
    const fields = {};
    if (edits.label != undefined) {
      fields.label = edits.label;
      changed.push("name");
    }
    if (edits.startDate != undefined) {
      fields.startDate = edits.startDate;
      changed.push("first day");
    }
    if (edits.endDate !== undefined) {
      fields.endDate = edits.endDate;
      changed.push("last day");
    }
    if (edits.recipients !== undefined) {
      fields.recipients = edits.recipients;
      changed.push("recipients");
    }
    let seasonChanged = changed.length > 0;

    const term = this.#season.term;
    const formURLs = { ...(entry.formURLs || {}) };
    const placed = this.#links.place(term, formURLs, edits.links);
    for (const formName of Object.keys(edits.links)) {
      const title = this.#season.formTitle(formName);
      changed.push(formName in placed.season ? `${title} link` : `${title} link (shared)`);
    }
    Object.assign(formURLs, placed.season);
    if (Object.keys(placed.season).length > 0) seasonChanged = true;
    let sharedChanged = placed.shared.length > 0;

    for (const formName of edits.clearedForms) {
      if (formURLs[formName]) {
        delete formURLs[formName];
        seasonChanged = true;
      }
      if (term != undefined && this.#season.formLinks.link(term, formName)) {
        this.#season.formLinks.clearLink(term, formName);
        sharedChanged = true;
      }
      changed.push(`${this.#season.formTitle(formName)} link`);
    }
    if (seasonChanged) this.#store.updateSeason(this.#season.currentSeasonID, { ...fields, formURLs });
    return { changed, seasonChanged, sharedChanged };
  }
}
