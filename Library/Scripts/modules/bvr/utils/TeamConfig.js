// A team's settings, assembled from layers: the level defaults
// (bvr/levels/<level>.json), the team's own overrides in teams.yaml, the
// school-wide forms (bvr/forms.json), and the staff directory for contact
// details. Produces the same shapes the per-team settings files used to hold,
// so Attendance, Game, PracticePlan, and the templates read them unchanged.
class TeamConfig {
  static defaultTemplates = {
    gameReport: "bvr/game-report.md",
    recordRow: "bvr/game-record-row.md",
    seasonRecord: "bvr/game-season-record.md",
    attendance: "bvr/attendance.md",
  };

  #team;
  #level;
  #forms;
  #staff;
  #attendanceOffice;
  #templateExists;
  #seasonRecipients;
  #options;

  // team: the teams.yaml entry. level, forms: parsed settings. staff: a Staff.
  // templateExists(file) tells whether a Library/Templates file exists.
  // seasonRecipients: the current season's { attendance, gameReport }
  // initials, which replace the recipient lists (nothing else) when set.
  constructor(options) {
    const { team, level, forms, staff, attendanceOffice = "ATT", templateExists = (_file) => false, seasonRecipients } = options;
    this.#options = options;
    this.#seasonRecipients = seasonRecipients == undefined ? {} : seasonRecipients;
    this.#team = team;
    this.#level = level == undefined ? {} : level;
    this.#forms = forms == undefined ? {} : forms;
    this.#staff = staff;
    this.#attendanceOffice = attendanceOffice;
    this.#templateExists = templateExists;
  }

  // Objects merge key by key; lists and plain values in the override replace.
  static merge(base, override) {
    const isObject = (value) => typeof value == "object" && value != null && !Array.isArray(value);
    if (!isObject(base) || !isObject(override)) {
      return override === undefined ? base : override;
    }

    const merged = { ...base };
    for (const [key, value] of Object.entries(override)) {
      merged[key] = TeamConfig.merge(base[key], value);
    }
    return merged;
  }

  // The same config with a season's recipient lists laid on top.
  withSeasonRecipients(seasonRecipients) {
    return new TeamConfig({ ...this.#options, seasonRecipients });
  }

  get teamID() {
    return this.#team.id;
  }

  // Who gets attendance and score messages by default (team override, else
  // level), as initials. The absences list stands for both attendance
  // messages, and the first score message's list for all of them.
  get defaultRecipients() {
    const { absences, noAbsences } = this.attendance;
    const firstMessage = (this.gameReport.messages || [])[0];
    return {
      attendance: [...((absences || noAbsences)?.recipients || [])],
      gameReport: [...(firstMessage?.recipients || [])],
    };
  }

  // The lists in effect: the season's override where set, else the default.
  get recipients() {
    const defaults = this.defaultRecipients;
    return {
      attendance: this.#seasonRecipients.attendance || defaults.attendance,
      gameReport: this.#seasonRecipients.gameReport || defaults.gameReport,
    };
  }

  // The forms this team submits after a game, by name.
  get formNames() {
    if (this.#team.forms != undefined) return [...this.#team.forms];
    const levelForms = this.#level.gameReport?.forms;
    return levelForms != undefined ? [...levelForms] : [];
  }

  get attendance() {
    return TeamConfig.merge(this.#level.attendance || {}, this.#team.attendance || {});
  }

  get gameReport() {
    return TeamConfig.merge(this.#level.gameReport || {}, this.#team.gameReport || {});
  }

  // What Attendance reads: the two message configs with contacts filled in.
  get attendanceSettings() {
    const { absences, noAbsences } = this.attendance;
    const seasonList = this.#seasonRecipients.attendance;
    return {
      absencesMsgConfig: this.#resolveMessage(absences, seasonList),
      noAbsencesMsgConfig: this.#resolveMessage(noAbsences, seasonList),
    };
  }

  // What Game reads: the after-game messages and the forms to submit. Form
  // URLs are per season, so Game adds them from the team file.
  get gameReportSettings() {
    const messages = this.gameReport.messages || [];
    return {
      messageSettings: messages.map((message) => this.#resolveMessage(message, this.#seasonRecipients.gameReport)),
      googleFormSettings: this.formNames.map((name) => this.form(name)),
    };
  }

  // One form's title, postData flag, and field map, plus its name.
  form(name) {
    const form = this.#forms[name];
    if (form == undefined) {
      throw new Error(`forms.yaml has no form named ${name} (listed for ${this.teamID})`);
    }
    return { name, ...JSON.parse(JSON.stringify(form)) };
  }

  // What the templates read. File names and tags follow from the team ID and
  // defaultTag unless teams.yaml overrides them.
  get templateSettings() {
    const team = this.#team;
    const templates = team.templates || {};
    const defaults = TeamConfig.defaultTemplates;

    const settings = {
      teamTemplateTags: this.teamTemplateTags,
      gameReport: {
        templateFile: templates.gameReport || defaults.gameReport,
        draftTags: [team.recapTag || `${team.defaultTag}/game/recap`],
      },
      recordRow: { templateFile: templates.recordRow || defaults.recordRow },
      seasonRecord: { templateFile: templates.seasonRecord || defaults.seasonRecord },
      practicePlan: { draftTags: [...(team.practicePlan?.draftTags || [])] },
      attendance: { templateFile: templates.attendance || defaults.attendance },
    };

    const thingsProject = templates.thingsProject || this.#derivedThingsProject();
    if (thingsProject) settings.thingsProject = { templateFile: thingsProject };
    if (templates.welcomeLetter) settings.welcomeLetter = { templateFile: templates.welcomeLetter };
    return settings;
  }

  // The team's plain tags (hc_year, ...) plus the ones that name people:
  // the first assistant coach, and the attendance office's email.
  get teamTemplateTags() {
    const tags = { ...(this.#team.templateTags || {}) };
    const assistant = (this.#team.assistantCoaches || [])[0];
    if (assistant != undefined) {
      tags.ac_name = this.#staff.contact(assistant, "name");
      tags.ac_email = this.#staff.contact(assistant, "email");
    }
    if (this.#staff.has(this.#attendanceOffice)) {
      tags.attendance_email = this.#staff.contact(this.#attendanceOffice, "email");
    }
    return tags;
  }

  // Swap initials for contacts: cell numbers for texts, emails for email
  // (and always for cc). seasonList, when given, replaces the recipients
  // only; cc, subject, and text stay as the level or team set them.
  #resolveMessage(message, seasonList) {
    if (message == undefined) return undefined;

    const field = `${message.type}`.toLowerCase() == "email" ? "email" : "cell";
    const initials = seasonList || message.recipients || [];
    const resolved = { ...message, recipients: this.#staff.contacts(initials, field) };
    if (message.ccRecipients != undefined) {
      resolved.ccRecipients = this.#staff.contacts(message.ccRecipients, "email");
    }
    return resolved;
  }

  // bvr/<id>-game-day-project.mustache, when the team has one.
  #derivedThingsProject() {
    const file = `bvr/${this.teamID}-game-day-project.mustache`;
    return this.#templateExists(file) ? file : undefined;
  }
}
