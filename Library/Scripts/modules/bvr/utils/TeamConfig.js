if (typeof DataFile == "undefined") require("modules/cp/filesystems/CloudFS.js");
if (typeof BVRUtilities == "undefined") require("modules/bvr/utils/BVRUtilities.js");

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
    endOfSeasonProject: "bvr/end-of-season-project.mustache",
    weeklySchedule: "bvr/weekly-schedule.mustache",
    weeklySummaryPrompt: "bvr/weekly-summary-prompt.mustache",
  };

  #team;
  #level;
  #forms;
  #staff;
  #attendanceOffice;
  #templateExists;
  #seasonRecipients;
  #seasonCoaches;
  #headCoach;
  #options;

  // team: the teams.yaml entry. level, forms: parsed settings. staff: a Staff.
  // attendanceOffice: the office's initials (settings.yaml.tpl).
  // templateExists(file) tells whether a Library/Templates file exists.
  // seasonRecipients: the current season's { attendance, gameReport }
  // initials, which replace the recipient lists (nothing else) when set.
  // headCoach: the usual head coach's initials (settings.yaml.tpl), for a
  // team without its own. seasonCoaches: the current season's { head,
  // assistants }, which replace the team's when set.
  constructor(options) {
    const {
      team, level, forms, staff, attendanceOffice, templateExists = (_file) => false,
      seasonRecipients, seasonCoaches, headCoach,
    } = options;
    this.#options = options;
    this.#seasonRecipients = seasonRecipients == undefined ? {} : seasonRecipients;
    this.#seasonCoaches = seasonCoaches == undefined ? {} : seasonCoaches;
    this.#headCoach = headCoach;
    this.#team = team;
    this.#level = level == undefined ? {} : level;
    this.#forms = forms == undefined ? {} : forms;
    this.#staff = staff;
    this.#attendanceOffice = attendanceOffice;
    this.#templateExists = templateExists;
  }

  // Objects merge key by key; lists and plain values in the override replace.
  static merge(base, override) {
    if (!DataFile.isObject(base) || !DataFile.isObject(override)) {
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

  // The same config with a season entry's recipients and coaches laid on top.
  withSeason(seasonData) {
    return new TeamConfig({ ...this.#options, seasonRecipients: seasonData?.recipients, seasonCoaches: seasonData?.coaches });
  }

  // The head coach and assistants typed into a coaches prompt. A blank field
  // means the default (defaults: defaultCoaches); only the first initials
  // typed for head coach count.
  static typedCoaches(fieldValues, defaults) {
    if (typeof Staff == "undefined") require("modules/bvr/utils/Staff.js");
    const head = Staff.parseInitials(fieldValues.headCoach)[0];
    const assistants = Staff.parseInitials(fieldValues.assistantCoaches);
    return {
      head: head || defaults.head,
      assistants: assistants.length > 0 ? assistants : defaults.assistants,
    };
  }

  // The season override to save: only what differs from the defaults, or
  // null when nothing does, so a teams.yaml change still reaches the team.
  // Assistants compare in order, since the first one gives ac_name.
  static coachOverrides(coaches, defaults) {
    const sameList = (a, b) => a.join(",") == b.join(",");
    const overrides = {};
    if (coaches.head != defaults.head) overrides.head = coaches.head;
    if (!sameList(coaches.assistants, defaults.assistants)) overrides.assistants = coaches.assistants;
    return Object.keys(overrides).length > 0 ? overrides : null;
  }

  // The two lists of initials typed into a recipients prompt. A blank field
  // means the default list (defaults: defaultRecipients).
  static typedRecipients(fieldValues, defaults) {
    if (typeof Staff == "undefined") require("modules/bvr/utils/Staff.js");
    const parse = (text, fallback) => {
      const initials = Staff.parseInitials(text);
      return initials.length > 0 ? initials : fallback;
    };
    return {
      attendance: parse(fieldValues.attendance, defaults.attendance),
      gameReport: parse(fieldValues.gameReport, defaults.gameReport),
    };
  }

  // The season override to save: only the lists that differ from the
  // defaults (in any order), or null when both match, so level changes
  // still reach the team.
  static recipientOverrides(lists, defaults) {
    const same = (a, b) => a.length == b.length && a.every((initials) => b.includes(initials));
    const overrides = {};
    if (!same(lists.attendance, defaults.attendance)) overrides.attendance = lists.attendance;
    if (!same(lists.gameReport, defaults.gameReport)) overrides.gameReport = lists.gameReport;
    return Object.keys(overrides).length > 0 ? overrides : null;
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

  // Weekly schedule email settings, such as practiceTime ("2:35 - 3:35").
  get weeklySchedule() {
    return TeamConfig.merge(this.#level.weeklySchedule || {}, this.#team.weeklySchedule || {});
  }

  // The team's coaches without a season override, as initials: its own
  // headCoach (else the usual head coach) and assistantCoaches.
  get defaultCoaches() {
    return {
      head: this.#team.headCoach || this.#headCoach,
      assistants: [...(this.#team.assistantCoaches || [])],
    };
  }

  // The coaches in effect: the season's override where set, else the default.
  get coaches() {
    const defaults = this.defaultCoaches;
    return {
      head: this.#seasonCoaches.head || defaults.head,
      assistants: this.#seasonCoaches.assistants || defaults.assistants,
    };
  }

  // The assistant coaches in effect, as initials.
  get assistantCoaches() {
    return [...this.coaches.assistants];
  }

  // What Attendance reads: the two message configs with contacts filled in,
  // plus the attendance form and the team's Team dropdown value when the
  // level or team names one (attendance.form, attendance.formTeam).
  get attendanceSettings() {
    const { absences, noAbsences, form, formTeam } = this.attendance;
    const seasonList = this.#seasonRecipients.attendance;
    const settings = {
      absencesMsgConfig: this.#resolveMessage(absences, seasonList),
      noAbsencesMsgConfig: this.#resolveMessage(noAbsences, seasonList),
    };
    if (form == undefined) return settings;
    return { ...settings, formSettings: this.form(form), formTeam };
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
  // defaultTag unless the level or teams.yaml names a file (the team wins).
  get templateSettings() {
    const team = this.#team;
    const templates = TeamConfig.merge(this.#level.templates || {}, team.templates || {});
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
      endOfSeasonProject: { templateFile: templates.endOfSeasonProject || defaults.endOfSeasonProject },
      weeklySchedule: {
        templateFile: templates.weeklySchedule || defaults.weeklySchedule,
        draftTags: [`${team.defaultTag}/weekly-email`],
        summaryPrompt: templates.weeklySummaryPrompt || defaults.weeklySummaryPrompt,
      },
    };

    const thingsProject = templates.thingsProject || this.#derivedThingsProject();
    if (thingsProject) settings.thingsProject = { templateFile: thingsProject };
    if (templates.welcomeLetter) settings.welcomeLetter = { templateFile: templates.welcomeLetter };
    return settings;
  }

  // The team's plain tags, plus the ones that name people: the coaches
  // (coachTags), and the attendance office's email.
  get teamTemplateTags() {
    const tags = { ...(this.#team.templateTags || {}), ...this.coachTags };
    if (this.#staff.has(this.#attendanceOffice)) {
      tags.attendance_email = this.#staff.contact(this.#attendanceOffice, "email");
    }
    return tags;
  }

  // Tags for the coaches in effect. The head coach gives hc_name, hc_email,
  // hc_coach_name (what players call them, from coachName in staff.yaml.tpl,
  // or the full name when there is none), hc_years_coaching (from coachingSince in staff.yaml.tpl) and hc_year
  // (from headCoachSince for this team's sport). The assistants give ac_name
  // and ac_email (the first one), ac_names (all of them, "A and B"), and for
  // Mustache templates assistants ([{ name, email }]) and ac_many (true for
  // two or more, to choose "coach is" or "coaches are"). A missing name
  // or email is blank rather than left out, so the usual head coach's never
  // shows through; a year tag without a date is left out.
  get coachTags() {
    const { head, assistants } = this.coaches;
    const detail = (initials, field) => this.#staff.detail(initials, field) || "";
    const tags = {};
    if (head != undefined) {
      tags.hc_name = detail(head, "name");
      tags.hc_email = detail(head, "email");
      tags.hc_coach_name = this.#staff.coachName(head) || "";
      const coaching = this.#yearTag(this.#staff.detail(head, "coachingSince"));
      const headCoaching = this.#yearTag(this.#staff.detail(head, "headCoachSince")?.[this.#team.sport]);
      if (coaching != undefined) tags.hc_years_coaching = coaching;
      if (headCoaching != undefined) tags.hc_year = headCoaching;
    }
    if (assistants.length > 0) {
      tags.ac_name = detail(assistants[0], "name");
      tags.ac_email = detail(assistants[0], "email");
      tags.ac_names = TeamConfig.joinNames(assistants.map((initials) => detail(initials, "name")).filter((name) => name != ""));
      tags.assistants = assistants.map((initials) => ({ name: detail(initials, "name"), email: detail(initials, "email") }));
      if (assistants.length > 1) tags.ac_many = true;
    }
    return tags;
  }

  // ["A"] → "A", ["A", "B"] → "A and B", ["A", "B", "C"] → "A, B, and C".
  static joinNames(names) {
    if (names.length <= 2) return names.join(" and ");
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  }

  // "11th" for a start date ("YYYY-MM-DD") 10 years and some back, or
  // undefined with no date.
  #yearTag(startDate) {
    const count = BVRUtilities.yearCount(startDate);
    return count == undefined ? undefined : BVRUtilities.ordinal(count);
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
