// A team's weekly practice plan draft, made from its practice plan template
// and listed in the team file by season week ("W3"). The plan's template can
// show the week's games and days off from the team's calendar: put
// [[monday_schedule]] ... [[friday_schedule]] where each day's notes start.
class PracticePlan {
  #bvr;
  #team;
  #settings;
  #tmplSettings;
  #weekID;
  #ppData;
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

  get ppData() {
    if (!this.#ppData) {
      this.#ppData = this.bvr.ppData;
    }
    return this.#ppData;
  }

  static create() {
    return new PracticePlan();
  }

  get settingsFile() {
    return this.bvr.ppSettingsFile;
  }

  get ppTmplSettings() {
    return this.#tmplSettings?.practicePlan;
  }

  // The team's season storage (team file or old files), chosen by Season.
  get store() {
    return this.team.season.store;
  }

  get practicePlans() {
    return this.store.practicePlans;
  }

  // "W7" in a team file, "2026W7" in practicePlans.json.
  get planID() {
    return this.store.practicePlanKey(this.weekID);
  }

  get weekID() {
    if (this.#weekID == undefined) this.#weekID = `W${this.#getCurrentWeek()}`;
    return this.#weekID;
  }

  // The Monday of the plan's week: this week on a weekday, the coming week
  // on a weekend, as the weekly email picks it.
  get monday() {
    return PracticePlan.planMonday(new Date());
  }

  get teamID() {
    return this.team.id;
  }

  get teamName() {
    return this.team.name;
  }
  // The current season's start date, or the team's from teams.yaml.
  get teamStartDate() {
    return this.team.season.startDate;
  }

  get ppTemplateFile() {
    return `${this.bvr.dirPrefix}${this.templateFile}`;
  }

  get defaultTemplateFile() {
    return this.bvr.defaultTemplateFile;
  }

  get templateFile() {
    if (this.ppData.practicePlanFile == undefined) {
      return `${this.teamID}-${this.defaultTemplateFile}`;
    }

    return this.team.templateFile;
  }

  get defaultTag() {
    return this.team.defaultTag;
  }

  get weekIDTemplateTag() {
    return this.bvr.weekIDTemplateTag;
  }

  // The BVR Coaching draft, where each plan gets a link under its team.
  get coachingDocument() {
    if (typeof CoachingDocument == "undefined") require("modules/bvr/core/CoachingDocument.js");
    return new CoachingDocument(this.bvr);
  }

  create() {
    if (!this.team.season.ensureCurrentSeason() || !this.#hasStartDate()) return;
    if (this.ppTmplSettings == undefined) {
      return alert("ppTmplSettings is undefined!");
    }
    if (
      this.practicePlans != undefined &&
      this.practicePlans[this.planID] != undefined
    ) {
      return this.load();
    }

    const templateSettings = this.ppTmplSettings;
    templateSettings.draftTags = [
      this.defaultTag,
      ...templateSettings.draftTags,
    ];
    templateSettings.templateFile = this.ppTemplateFile;
    if (templateSettings.templateTags == undefined) {
      templateSettings.templateTags = {};
    }
    templateSettings.templateTags[this.weekIDTemplateTag] = this.weekID;
    Object.assign(templateSettings.templateTags, this.#scheduleTags());
    const newPlan = this.bvr.createDraftFromTemplate(templateSettings);

    this.#savePracticePlan(newPlan.draftID);
    this.#insertPracticePlanLink(newPlan.displayTitle);
  }

  load() {
    if (!this.team.season.ensureCurrentSeason() || !this.#hasStartDate()) return;
    const draftID = this.practicePlans?.[this.planID];
    if (draftID == undefined) {
      return this.bvr.ui.displayAppMessage("info", "No practice plan found.");
    }
    const practicePlan = Draft.find(draftID);

    this.bvr.pinDraft(practicePlan);
  }

  // Asks which of this season's plans to delete, then trashes its draft,
  // drops it from the team file, and takes its link out of the coaching
  // draft, so Create Practice Plan can make that week again.
  delete() {
    if (!this.team.season.ensureCurrentSeason()) return;
    const planID = this.#pickPlan();
    if (planID == undefined) return;

    const plan = DraftsRuntime.findDraft(this.practicePlans[planID]);
    const title = plan == undefined ? planID : plan.displayTitle;
    if (!this.#confirmDelete(title)) return;

    if (plan != undefined) {
      plan.isTrashed = true;
      plan.update();
      this.#removePracticePlanLink(title);
    }
    this.store.deletePracticePlan(planID);
    this.bvr.ui.displayAppMessage("success", `Deleted ${title}.`);
  }

  #savePracticePlan(draftID) {
    this.store.savePracticePlan(this.planID, draftID);
  }

  // Links the new plan under the team's heading in the coaching draft,
  // adding the heading when the team has none yet.
  #insertPracticePlanLink(title) {
    if (title == undefined) {
      return this.bvr.ui.displayAppMessage("error", "The new practice plan has no title.");
    }
    this.coachingDocument.addPlanLink(this.teamName, title);
  }

  // One button per plan this season, newest week first. Undefined when there
  // are none or the prompt is cancelled.
  #pickPlan() {
    const planIDs = PracticePlan.newestFirst(Object.keys(this.practicePlans || {}));
    if (planIDs.length == 0) {
      this.bvr.ui.displayAppMessage("info", `${this.teamName} has no practice plans this season.`);
      return undefined;
    }

    const { pickPlan } = this.bvr.ui.settingsCopy("deletePracticePlan");
    const menuItems = planIDs.map((planID) => {
      const plan = Draft.find(this.practicePlans[planID]);
      const name = plan == undefined ? `${planID} (draft not found)` : plan.displayTitle;
      return { type: "button", data: { name, value: planID } };
    });
    const prompt = this.bvr.ui.buildMenu({ ...pickPlan, menuItems });
    if (prompt.show() == false) return undefined;
    return prompt.buttonPressed;
  }

  #confirmDelete(title) {
    const { confirmPrompt } = this.bvr.ui.settingsCopy("deletePracticePlan");
    const menuMessage = `${confirmPrompt.menuMessage}\n\n${title}`;
    return this.bvr.ui.yesNoPrompt({ ...confirmPrompt, menuMessage }) == "yes";
  }

  // Removes the [[title]] line Create Practice Plan put in the coaching draft.
  #removePracticePlanLink(title) {
    this.coachingDocument.removePlanLink(title);
  }

  // The template tags for the plan's week from the team's calendar (see
  // scheduleTags). Every day reads "-" when the team has no calendar.
  #scheduleTags() {
    const monday = this.monday;
    const calendarName = this.team.calendar;
    const calendar = calendarName == undefined ? undefined : Calendar.find(calendarName);
    if (calendarName != undefined && calendar == undefined) {
      this.bvr.ui.displayAppMessage("warning", `There is no calendar named ${calendarName}.`);
    }

    const events = calendar == undefined ? [] : calendar.events(monday, WeeklySchedule.addDays(monday, 7));
    return PracticePlan.scheduleTags(events, monday);
  }

  // The week number needs a start date, from the season or teams.yaml.
  #hasStartDate() {
    if (this.teamStartDate != undefined) return true;

    this.bvr.ui.displayAppMessage(
      "info",
      `${this.teamName}'s current season has no start date. Run Start New Season, or set startDate in its team file.`,
    );
    return false;
  }

  #getCurrentWeek() {
    return PracticePlan.weekNumber(this.teamStartDate, this.monday);
  }

  // **********************
  // Static Functions
  // **********************

  // The Monday of the week a plan made on date is for. Same rule as the
  // weekly email: the date's own week on a weekday, the next on a weekend.
  static planMonday(date) {
    PracticePlan.#requireWeeklySchedule();
    return WeeklySchedule.scheduleMonday(date);
  }

  // One tag per day, monday_schedule to sunday_schedule, for the plan
  // template: a "- " line for each event that is not a practice (games,
  // No Practice, anything else on the calendar), or "-" when practice is on
  // as usual, leaving the day's usual empty bullet.
  static scheduleTags(events, monday) {
    PracticePlan.#requireWeeklySchedule();
    const tags = {};
    WeeklySchedule.dayNames.forEach((day, index) => {
      const lines = WeeklySchedule.eventsOn(events, WeeklySchedule.addDays(monday, index))
        .filter((event) => !PracticePlan.isPractice(event))
        .map((event) => `- ${PracticePlan.describeEvent(event)}`);
      tags[`${day.toLowerCase()}_schedule`] = lines.length > 0 ? lines.join("\n") : "-";
    });
    return tags;
  }

  static isPractice(event) {
    return `${event.title || ""}`.trim().toLowerCase() == "practice";
  }

  // The calendar title with its notes after it: "**Game: Home vs Newton**
  // (Main Gym, 4:00)", "**No Practice** (Thanksgiving)". Games and No
  // Practice are bold so they stand out. Note lines join with commas so each
  // event stays on one line.
  static describeEvent(event) {
    const calendarTitle = `${event.title || ""}`.trim();
    const title = PracticePlan.isHighlighted(calendarTitle) ? `**${calendarTitle}**` : calendarTitle;
    const notes = `${event.notes || ""}`
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line != "")
      .join(", ");
    return notes == "" ? title : `${title} (${notes})`;
  }

  // Games and No Practice, read the way the weekly email reads them.
  static isHighlighted(title) {
    if (typeof Game == "undefined") require("modules/bvr/core/Game.js");
    return title.toLowerCase() == "no practice" || Game.parseCalendarTitle(title) != undefined;
  }

  // Plan IDs ("W3", or "2026W3" in practicePlans.json), latest week first.
  static newestFirst(planIDs) {
    const week = (planID) => Number(`${planID}`.split("W").pop());
    return [...planIDs].sort((a, b) => week(b) - week(a));
  }

  // WeeklySchedule requires this file, so load it when first needed.
  static #requireWeeklySchedule() {
    if (typeof WeeklySchedule == "undefined") require("modules/bvr/core/WeeklySchedule.js");
  }

  // Season week of currentDate, counting ISO weeks (Monday to Sunday) from
  // startDate ("YYYY-MM-DD"). The week holding the start date is week 1.
  static weekNumber(startDate, currentDate = new Date()) {
    if (typeof BVRUtilities == "undefined") require("modules/bvr/utils/BVRUtilities.js");
    const start = BVRUtilities.parseDateYMD(startDate);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeks = (this.isoMonday(currentDate) - this.isoMonday(start)) / msPerWeek;
    return Math.floor(weeks) + 1;
  }

  // Midnight UTC of the Monday starting date's ISO week, as a timestamp.
  static isoMonday(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7; // Convert Sunday (0) to 7
    d.setUTCDate(d.getUTCDate() - day + 1); // Back to Monday
    return d.getTime();
  }

  #getNextWeek() {
    return this.#getCurrentWeek() + 1;
  }
}
