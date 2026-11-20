if (typeof DraftsRuntime == "undefined") require("shared/libraries/DraftsRuntime.js");
if (typeof MarkdownSections == "undefined") require("shared/libraries/MarkdownSections.js");

// The BVR Coaching draft (coachingDraftID in bvr/settings.yaml.tpl): one
// "## <team name>" section per team, holding links to that team's roster and
// practice plans. Create Practice Plan adds a plan's link to its team's
// section, adding the section when the team has none. Delete Practice Plan
// takes the link out. Clean Up Coaching Document moves plan links that ended
// up outside their team's section back into it.
//
// The static functions work on the draft's text, so they run in unit tests;
// the instance methods find the draft and save it.
class CoachingDocument {
  #bvr;

  constructor(bvr) {
    this.#bvr = bvr;
  }

  // The coaching draft. DraftsRuntime.findDraft returns the global draft
  // when the action runs on it, so the change is not reverted when the
  // script step ends (docs/reference/drafts-runtime.md).
  get draft() {
    return DraftsRuntime.findDraft(this.#bvr.coachingDraftID);
  }

  // Adds [[title]] as the last line of the team's section.
  addPlanLink(teamName, title) {
    const link = CoachingDocument.link(title);
    this.#edit((content) => CoachingDocument.addLink(content, teamName, link));
  }

  // Removes every [[title]] line, wherever it is.
  removePlanLink(title) {
    const link = CoachingDocument.link(title);
    this.#edit((content) => CoachingDocument.removeLink(content, link));
  }

  // Moves the plan links of every team in season into the team's section,
  // then says what moved.
  cleanUp() {
    let result;
    this.#edit((content) => {
      result = CoachingDocument.placeLinks(content, this.#activePlanLinks());
      return result.content;
    });
    if (result != undefined) this.#reportCleanUp(result);
  }

  // Runs change on the draft's content and saves the result when it differs.
  #edit(change) {
    const coachingDraft = this.draft;
    if (coachingDraft == undefined) {
      return this.#bvr.ui.displayAppMessage("error", "The BVR Coaching draft was not found. Check coachingDraftID in bvr/settings.");
    }

    const content = change(coachingDraft.content);
    if (content == coachingDraft.content) return;
    coachingDraft.content = content;
    coachingDraft.update();
  }

  // { teamName, link } for each plan of each team whose season is under way,
  // oldest week first so moved links land in week order. Plans whose draft
  // is gone are skipped.
  #activePlanLinks() {
    if (typeof Settings == "undefined") require("modules/cp/filesystems/CloudFS.js");
    if (typeof TeamFileStore == "undefined") require("modules/bvr/storage/TeamFileStore.js");
    if (typeof PracticePlan == "undefined") require("modules/bvr/core/PracticePlan.js");

    const teamsData = new Settings(this.#bvr.teamSettingsFile).load("teamsData");
    const today = this.#bvr.formatDateYMD(new Date());
    const activeTeams = TeamFileStore.activeTeams(teamsData, (id) => this.#bvr.teamFilePath(id), today);

    return activeTeams.flatMap(({ team, store }) => {
      const plans = store.practicePlans || {};
      return PracticePlan.newestFirst(Object.keys(plans))
        .reverse()
        .map((planID) => Draft.find(plans[planID]))
        .filter((plan) => plan != undefined)
        .map((plan) => ({ teamName: team.name, link: CoachingDocument.link(plan.displayTitle) }));
    });
  }

  #reportCleanUp({ moved, ambiguous }) {
    const ui = this.#bvr.ui;
    if (ambiguous.length > 0) {
      ui.displayAppMessage("warning", `Left in place, more than one team has a plan named: ${ambiguous.join(", ")}`);
    }
    if (moved.length > 0) {
      const links = moved.length == 1 ? "link" : "links";
      ui.displayAppMessage("success", `Moved ${moved.length} practice plan ${links}.`);
    } else if (ambiguous.length == 0) {
      ui.displayAppMessage("info", "The coaching document is already tidy.");
    }
  }

  // **********************
  // Static Functions
  // **********************

  static link(title) {
    return `[[${title}]]`;
  }

  static heading(teamName) {
    return `## ${teamName}`;
  }

  // content with link added after the last non-blank line of the team's
  // section, so plans read in week order under the roster link. A team with
  // no section gets one at the end of the draft. The section runs to the
  // next "#" or "##" heading; "###" subheadings stay inside it.
  static addLink(content, teamName, link) {
    const heading = CoachingDocument.heading(teamName);
    const lines = CoachingDocument.#withSection(`${content}`.split("\n"), heading);
    const body = MarkdownSections.body(lines, heading);

    let end = body.length;
    while (end > 0 && body[end - 1].trim() == "") end--;
    const newBody = [...body.slice(0, end), link, ...body.slice(end)];
    return MarkdownSections.replaceBody(lines, heading, newBody).join("\n");
  }

  // content without any line that is exactly link.
  static removeLink(content, link) {
    return `${content}`
      .split("\n")
      .filter((line) => line.trim() != link)
      .join("\n");
  }

  // Moves each plan link that sits outside its team's section into it, adding
  // the section when needed. plans: [{ teamName, link }]. A link in the draft
  // once inside its section and again elsewhere loses the stray copy. Links
  // not in the draft stay out, since removing them is how old weeks get
  // cleared. A link that more than one team's plans share is left alone and
  // reported, because there is no telling which section it belongs in.
  // Returns { content, moved: [link], ambiguous: [link] }.
  static placeLinks(content, plans) {
    const teamsByLink = new Map();
    plans.forEach(({ teamName, link }) => {
      teamsByLink.set(link, new Set([...(teamsByLink.get(link) || []), teamName]));
    });

    const moved = [];
    const ambiguous = [];
    let text = `${content}`;
    plans.forEach(({ teamName, link }) => {
      if (teamsByLink.get(link).size > 1) {
        if (!ambiguous.includes(link)) ambiguous.push(link);
        return;
      }
      const placed = CoachingDocument.#placeLink(text, teamName, link);
      if (placed == text) return;
      text = placed;
      moved.push(link);
    });

    return { content: text, moved, ambiguous };
  }

  // content with link only inside the team's section. Unchanged when the
  // link is not in the draft, or is in the draft only inside its section.
  static #placeLink(content, teamName, link) {
    const heading = CoachingDocument.heading(teamName);
    const isLink = (line) => line.trim() == link;
    const lines = `${content}`.split("\n");
    const body = MarkdownSections.body(lines, heading) || [];

    const inSection = body.filter(isLink).length;
    const stray = lines.filter(isLink).length - inSection;
    if (stray == 0) return content;

    // Take out every copy, then put the section back as it was, or add the
    // link to it when it had none.
    const withoutLink = CoachingDocument.removeLink(content, link);
    if (inSection == 0) return CoachingDocument.addLink(withoutLink, teamName, link);
    return MarkdownSections.replaceBody(withoutLink.split("\n"), heading, body).join("\n");
  }

  // lines with a heading section at the end, after one blank line, when
  // there is none. Keeps the draft's trailing newline.
  static #withSection(lines, heading) {
    if (MarkdownSections.headingIndex(lines, heading) != -1) return lines;

    const kept = [...lines];
    while (kept.length > 0 && kept[kept.length - 1].trim() == "") kept.pop();
    return [...kept, "", heading, ""];
  }
}
