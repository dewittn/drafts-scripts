if (typeof LunchMenu == "undefined") require("modules/nr/LunchMenu.js");

// Shows today's lunch from the week's menu draft in a dialog.
//
// On a weekend, or a weekday the menu does not cover, it opens the newest
// menu instead. A weekday on the menu with no items (no school) says so.
class WhatsForLunch {
  #settings;
  #ui;
  #menuDraft;

  constructor(settings, ui, menuDraft) {
    this.#settings = settings;
    this.#ui = ui;
    this.#menuDraft = menuDraft;
  }

  static isWeekend(date) {
    return [0, 6].includes(date.getDay());
  }

  // The day's notes as dialog text: prompts show Markdown as typed, so the
  // bold markers go.
  static dialogText(day) {
    return day.notes.replace(/\*\*/g, "");
  }

  get settings() {
    return this.#settings;
  }

  get menuDraft() {
    this.#menuDraft ??= LunchMenu.find(this.settings);
    return this.#menuDraft;
  }

  show(now = new Date()) {
    const { messages } = this.settings;
    if (this.menuDraft == undefined) {
      return this.#ui.displayErrorMessage(messages.noMenu, {
        class: "WhatsForLunch",
        function: "show()",
        menuTag: this.settings.menuTag,
        menuDraftUUID: this.settings.menuDraftUUID,
      });
    }

    const today = WhatsForLunch.isWeekend(now) ? undefined : LunchMenu.dayOn(LunchMenu.parse(this.menuDraft.content), now);
    if (today == undefined) return this.openMenu();
    if (today.items.length == 0) return this.#ui.displayAppMessage("info", messages.noLunch);

    const dialog = this.#ui.buildMenu({
      ...this.settings.dialog,
      menuTitle: `${today.weekday}'s Lunch`,
      menuMessage: WhatsForLunch.dialogText(today),
    });
    if (dialog.show() && dialog.buttonPressed == "open") this.openMenu();
    return true;
  }

  openMenu() {
    editor.load(this.menuDraft);
    return true;
  }
}
