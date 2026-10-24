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

  get coachingDraftID() {
    return this.bvr.coachingDraftID;
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
    const newPlan = this.bvr.createDraftFromTemplate(templateSettings);

    this.#savePracticePlan(newPlan.draftID);
    this.#insertPraticePlanLink(newPlan.displayTitle);
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

  #savePracticePlan(draftID) {
    this.store.savePracticePlan(this.planID, draftID);
  }

  #insertPraticePlanLink(linkTxt) {
    if (linkTxt == undefined) {
      return this.bvr.ui.displayAppMessage("error", "linkTxt is undefined");
    }

    const coachingDraft = Draft.find(this.coachingDraftID);
    const insertPosision = coachingDraft.lines.findIndex(
      (lineTxt) => lineTxt == `## ${this.teamName}`,
    ) + 2;

    coachingDraft.insert(`[[${linkTxt}]]`, insertPosision);
    coachingDraft.update();
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
    return PracticePlan.weekNumber(this.teamStartDate);
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
