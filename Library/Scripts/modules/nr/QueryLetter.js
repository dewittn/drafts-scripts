if (typeof Template == "undefined") require("modules/cp/templates/Template.js");

// Generates a personalized query letter for a literary agent.
//
// Reads the agent list (a Markdown task list) from a source draft, prompts for
// an agent who has not yet been queried, fills the query letter template,
// creates the new draft in the archive, and checks the agent off in the source.
class QueryLetter {
  #settings;
  #ui;
  #sourceDraft;

  constructor(settings, ui, sourceDraft) {
    this.#settings = settings;
    this.#ui = ui;
    this.#sourceDraft = sourceDraft;
  }

  // Splits a task label like "Jane Doe (Big Agency) - notes" into its parts.
  // Markdown emphasis and links are stripped; the agent name is the text before
  // the first parenthetical or dash separator.
  static parseAgentLabel(label = "") {
    const plain = label
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();

    const match = plain.match(/^(.*?)(?:\s*\((.*?)\))?(?:\s+[-–—]\s+(.*))?$/);
    if (match == null) return { name: plain, note: "" };

    const note = [match[2], match[3]].filter(Boolean).join(" – ");
    return { name: match[1].trim(), note };
  }

  get settings() {
    return this.#settings;
  }

  get sourceDraft() {
    if (this.#sourceDraft != undefined) return this.#sourceDraft;

    const { sourceDraftUUID, sourceTag } = this.settings;
    const found = Draft.find(sourceDraftUUID) ?? Draft.query("", "all", [sourceTag])[0];

    // Drafts writes the global draft back to the editor when the script ends,
    // so a change made through a separate copy is lost if the agent list is
    // the open draft. Work on the global object in that case.
    const openDraft = typeof draft == "undefined" ? undefined : draft;
    this.#sourceDraft = openDraft?.uuid == found?.uuid ? openDraft : found;
    return this.#sourceDraft;
  }

  // Agents that have not been checked off yet, in document order.
  get remainingAgents() {
    return this.sourceDraft.incompleteTasks.map((task) => ({
      task,
      ...QueryLetter.parseAgentLabel(task.label),
    }));
  }

  create() {
    if (this.sourceDraft == undefined) {
      return this.#ui.displayErrorMessage("Agent list draft could not be found!", {
        class: "QueryLetter",
        function: "create()",
        sourceDraftUUID: this.settings.sourceDraftUUID,
        sourceTag: this.settings.sourceTag,
      });
    }

    const agents = this.remainingAgents;
    if (agents.length == 0) {
      return this.#ui.displayAppMessage("info", "Every agent on the list has been queried!");
    }

    const selection = this.#promptForAgent(agents);
    if (selection == undefined) return false;

    const { agent, templateTags } = selection;
    const letter = this.#createLetter(agent, templateTags);
    if (letter == undefined) return false;

    this.#markQueried(agent);
    letter.activate();
    this.#ui.displayAppMessage("success", `Query letter created for ${agent.name}`);
    return letter;
  }

  #promptForAgent(agents) {
    const { menuSettings, pickerData } = this.settings;
    const names = agents.map((agent) => (agent.note ? `${agent.name} (${agent.note})` : agent.name));

    // Copy settings so the picker is not pushed onto the shared menu twice.
    const menu = { ...menuSettings, menuItems: [...(menuSettings.menuItems ?? [])] };
    menu.menuItems.unshift({ type: "picker", data: { ...pickerData, columns: [names] } });

    const prompt = this.#ui.buildMenu(menu);
    if (prompt.show() == false) return undefined;

    const { [pickerData.name]: pickerValue, ...fieldValues } = prompt.fieldValues;
    const agent = agents[pickerValue[0]];

    // Every other prompt field becomes a template tag with the same name.
    // Select fields return arrays, so their choices are joined into one string.
    const templateTags = { agent: agent.name, agentNote: agent.note };
    for (const [key, value] of Object.entries(fieldValues)) {
      if (typeof value == "string") templateTags[key] = value;
      if (Array.isArray(value)) templateTags[key] = value.join(", ");
    }

    return { agent, templateTags };
  }

  #createLetter(agent, templateTags) {
    const { templateFile, draftTags = [], workspaceName } = this.settings;

    if (Template.load(templateFile) == undefined) {
      return this.#ui.displayErrorMessage(`Query letter template "${templateFile}" could not be read!`, {
        class: "QueryLetter",
        function: "#createLetter()",
        templateFile,
      });
    }

    const letter = new Template({ templateFile, templateTags, draftTags, workspaceName });
    return letter.archive().save();
  }

  #markQueried(agent) {
    this.sourceDraft.completeTask(agent.task);
    this.sourceDraft.update();
  }
}
