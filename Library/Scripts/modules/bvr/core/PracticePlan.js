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
      this.#bvr = BVR.getInstance();
    }
    return this.#bvr;
  }

  get team() {
    if (!this.#team && this.#dependencies == undefined) {
      if (typeof Team == "undefined") require("modules/bvr/core/Team.js");
      this.#team = Team.getInstance();
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

  get practicePlans() {
    return this.ppData[this.teamID];
  }

  get planID() {
    return `${this.bvr.getYear()}${this.weekID}`;
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
  get teamStartDate() {
    return this.team.startDate;
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
    if (this.practicePlans == undefined) {
      return this.bvr.ui.displayAppMessage("info", "No practice plan found.");
    }
    const draftID = this.practicePlans[this.planID];
    const practicePlan = Draft.find(draftID);

    this.bvr.pinDraft(practicePlan);
  }

  #savePracticePlan(draftID) {
    if (this.practicePlans == undefined) {
      this.ppData[this.teamID] = {};
    }

    this.practicePlans[this.planID] = draftID;
    this.ppData.save();
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

  #getCurrentWeek() {
    const currentDate = new Date();
    const parts = this.teamStartDate.split("-");
    const startDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const currentMonday = this.#getISOMonday(currentDate);
    const startMonday = this.#getISOMonday(startDate);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    return Math.floor((currentMonday - startMonday) / msPerWeek) + 1;
  }

  #getISOMonday(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7; // Convert Sunday (0) to 7
    d.setUTCDate(d.getUTCDate() - day + 1); // Back to Monday
    return d.getTime();
  }

  #getNextWeek() {
    return this.#getCurrentWeek() + 1;
  }
}
