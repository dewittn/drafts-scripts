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
  };

  #team;
  #level;
  #forms;
  #staff;
  #attendanceOffice;
  #templateExists;

  // team: the teams.yaml entry. level, forms: parsed settings. staff: a Staff.
  // templateExists(file) tells whether a Library/Templates file exists.
  constructor({ team, level, forms, staff, attendanceOffice = "ATT", templateExists = (_file) => false }) {
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

  get teamID() {
    return this.#team.id;
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
    return {
      absencesMsgConfig: this.#resolveMessage(absences),
      noAbsencesMsgConfig: this.#resolveMessage(noAbsences),
    };
  }

  // What Game reads: the after-game messages and the forms to submit. Form
  // URLs are per season, so Game adds them from the team file.
  get gameReportSettings() {
    const messages = this.gameReport.messages || [];
    return {
      messageSettings: messages.map((message) => this.#resolveMessage(message)),
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
  // (and always for cc).
  #resolveMessage(message) {
    if (message == undefined) return undefined;

    const field = `${message.type}`.toLowerCase() == "email" ? "email" : "cell";
    const resolved = { ...message, recipients: this.#staff.contacts(message.recipients || [], field) };
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
