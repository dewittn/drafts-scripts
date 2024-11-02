class GameReport {
  #game;
  #tmplSettings;

  constructor(dependancies) {
    this.#game = dependancies.game;
    this.#tmplSettings = dependancies.templateSettings;
  }

  // **********************
  // Getter/Setter
  // **********************

  get ui() {
    return this.#game.ui;
  }

  get teamID() {
    return this.#game.teamID;
  }

  get teamName() {
    return this.#game.teamName;
  }

  get teamPlays() {
    return this.#game.teamPlays;
  }

  get recorded() {
    if (this.#game.recorded == undefined) return false;

    return this.#game.recorded;
  }

  get gameReportTmplSettings() {}

  // **********************
  // Public Functions
  // **********************

  generate() {
    if (this.recorded == false || this.#tmplSettings == undefined) return;

    this.gameReportDraft = new Template(this.#tmplSettings);
    this.gameReportDraft.archive().save().activate();
    this.#game.draftID = this.gameReportDraft.draftID;
    this.#game.submitted = false;
  }

  submit() {
    alert("Submit game report!");
    if (this.#game == undefined) return;

    if (this.#game.submitted)
      return this.ui.displayAppMessage(
        "info",
        "this game has already been submitted!"
      );

    const { modifiedArray: modifiedDraft, sectionText: comments } =
      this.#extractSectionText(draft.lines, `## Other/Comments`);
    const { sectionText: highlights } = this.#extractSectionText(
      modifiedDraft,
      `## Highlights?`
    );

    this.#game.comments = comments;
    this.#game.highlights = highlights;

    if (this.#game.msgSettings != undefined) this.#sendMessages();
    if (this.#game.googleFormSettings != undefined) this.#submitGoogleForm();
    this.#game.submitted = true;
    this.#game.updateSeasonRecord();
  }

  // **********************
  // Public Functions
  // **********************

  #sendMessages() {
    this.#game.msgSettings.forEach((msgConfig) =>
      this.#createAndSendMessage(msgConfig)
    );
  }

  #createAndSendMessage(msgConfig) {
    msgConfig.templateTags = this.#tmplSettings;

    const message = meesageFactory(msgConfig);
    message.compose();

    if (message.messageText != "") message.send();
  }

  #submitGoogleForm() {
    const formData = {
      teamName: this.#game.teamName,
      hcName: this.#game.headCoachName,
      formattedDate: this.#game.formattedDate,
      opponent: this.#game.opponent,
      result: this.#game.result,
      fullScore: this.#game.fullScore,
      highlights: this.#game.highlights,
      reported: "Not applicable (non-varsity team)",
      comments: this.#game.comments,
      scoreUs: this.#game.scoreUs,
      scoreThem: this.#game.scoreThem,
      googleFormDate: this.#game.googleFormDate,
    };
    const dependancies = {
      settings: this.#game.googleFormSettings,
      formData: formData,
    };

    const googleForm = new GoogleForm(dependancies);
    googleForm.submit();
  }

  #extractSectionText(array, sectionHeader) {
    const { sectionStart, sectionEnd } = this.#getSectionStartEnd(
      array,
      sectionHeader
    );
    const sectionText = array
      .splice(sectionStart, sectionEnd)
      .slice(2)
      .join("");
    return { modifiedArray: array, sectionText: sectionText };
  }

  #getSectionStartEnd(array, text) {
    return {
      sectionStart: array.findIndex((item) => item == text),
      sectionEnd: array.length,
    };
  }
}
