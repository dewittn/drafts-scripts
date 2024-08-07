class PracticePlan {
  #bvr;
  #team;
  #settings;
  #tmplSettings;
  #weekID;
  #ppData;

  constructor(dependancies) {
    if (dependancies == undefined)
      dependancies = {
        bvr: new BVR(),
        team: new Team(),
      };

    this.#bvr = dependancies.bvr;
    this.#team = dependancies.team;

    this.#ppData = this.#bvr.ppData;
    this.#tmplSettings = this.#team.templateSettings;
  }

  static create() {
    return new PracticePlan();
  }

  get settingsFile() {
    return this.#bvr.ppSettingsFile;
  }

  get ppTmplSettings() {
    return this.#tmplSettings.practicePlan;
  }

  get practicePlans() {
    return this.#ppData[this.teamID];
  }

  get planID() {
    return `${this.#bvr.getYear()}${this.weekID}`;
  }

  get weekID() {
    if (this.#weekID == undefined) this.#weekID = `W${this.#getCurrentWeek()}`;
    return this.#weekID;
  }

  get teamID() {
    return this.#team.id;
  }

  get teamName() {
    return this.#team.name;
  }
  get teamStartDate() {
    return this.#team.startDate;
  }

  get ppTemplateFile() {
    return `${this.#bvr.dirPrefix}${this.templateFile}`;
  }

  get defaultTemplateFile() {
    return this.#bvr.defaultTemplateFile;
  }

  get templateFile() {
    if (this.#ppData.practicePlanFile == undefined) return `${this.teamID}-${this.defaultTemplateFile}`;

    return this.#team.templateFile;
  }

  get defaultDraftTags() {
    return this.#tmplSettings.defaultDraftTags;
  }

  get weekIDTemplateTag() {
    return this.#bvr.weekIDTemplateTag;
  }

  get coachingDraftID() {
    return this.#bvr.coachingDraftID;
  }

  create() {
    if (this.ppTmplSettings == undefined) return alert("ppTmplSettings is undefined!");
    if (this.practicePlans[this.planID] != undefined) return this.load();

    const templateSettings = this.ppTmplSettings;
    templateSettings.draftTags = [...this.defaultDraftTags, ...templateSettings.draftTags];
    templateSettings.templateFile = this.ppTemplateFile;
    if (templateSettings.templateTags == undefined) templateSettings.templateTags = {};
    templateSettings.templateTags[this.weekIDTemplateTag] = this.weekID;
    const newPlan = this.#bvr.createDraftFromTemplate(templateSettings);

    this.#savePracticePlan(newPlan.draftID);
    this.#insertPraticePlanLink(newPlan.displayTitle);
  }

  load() {
    const draftID = this.practicePlans[this.planID];
    const practicePlan = Draft.find(draftID);

    this.#bvr.pinDraft(practicePlan);
  }

  #savePracticePlan(draftID) {
    this.practicePlans[this.planID] = draftID;
    this.#ppData.save();
  }

  #insertPraticePlanLink(linkTxt) {
    if (linkTxt == undefined) return alert("linkTxt is undefined");

    const coachingDraft = Draft.find(this.coachingDraftID);
    const insertPosision = coachingDraft.lines.findIndex((lineTxt) => lineTxt == `## ${this.teamName}`) + 2;

    coachingDraft.insert(`[[${linkTxt}]]`, insertPosision);
    coachingDraft.update();
  }

  #getCurrentWeek() {
    const oneWeekInMilliseconds = 7 * 24 * 60 * 60 * 1000;
    const currentDate = new Date();
    const targetDate = new Date(this.teamStartDate);
    const timeDifference = currentDate.getTime() - targetDate.getTime();
    const currentWeek = Math.floor(timeDifference / oneWeekInMilliseconds + 1);
    return currentWeek;
  }

  #getNextWeek() {
    return this.#getCurrentWeek() + 1;
  }
}
