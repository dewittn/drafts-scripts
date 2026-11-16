if (typeof LunchMenu == "undefined") require("modules/nr/LunchMenu.js");
if (typeof ThingsParser == "undefined") require("modules/nr/ThingsParser.js");

// Adds a Things to-do for each school day picked from the week's lunch menu,
// so there is a reminder to pack containers for bringing food home.
//
// Each to-do is scheduled for its day with a reminder at reminderTime, and
// the day's menu goes in its notes. Days with no menu items (no school) and
// days whose reminder time has passed are not offered.
class LunchReminders {
  #settings;
  #ui;
  #menuDraft;

  constructor(settings, ui, menuDraft) {
    this.#settings = settings;
    this.#ui = ui;
    this.#menuDraft = menuDraft;
  }

  // Days worth a reminder: they have food on the menu and their reminder
  // time is still ahead of now.
  static upcomingDays(days, now, reminderTime) {
    return days.filter((day) => day.items.length > 0 && LunchReminders.reminderAt(day.date, reminderTime) > now);
  }

  static reminderAt(date, reminderTime) {
    const [hours, minutes] = reminderTime.split(":").map(Number);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
  }

  // Things' "when" value with a reminder, e.g. "2026-11-16@11:00".
  static thingsWhen(date, reminderTime) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}@${reminderTime}`;
  }

  // What the day picker shows: the weekday and its first menu item.
  static dayLabel(day) {
    return `${day.weekday}: ${day.items[0]}`;
  }

  get settings() {
    return this.#settings;
  }

  // The open draft when it is a lunch menu, then menuDraftUUID when set,
  // then the newest draft with the menu tag.
  get menuDraft() {
    if (this.#menuDraft != undefined) return this.#menuDraft;

    const { menuTag, menuDraftUUID } = this.settings;
    const openDraft = typeof draft == "undefined" ? undefined : draft;
    if (openDraft?.hasTag(menuTag)) return (this.#menuDraft = openDraft);

    const byUUID = menuDraftUUID ? Draft.find(menuDraftUUID) : undefined;
    this.#menuDraft = byUUID ?? Draft.query("", "all", [menuTag], [], "created", true)[0];
    return this.#menuDraft;
  }

  create(now = new Date()) {
    const { messages, reminderTime } = this.settings;
    if (this.menuDraft == undefined) {
      return this.#ui.displayErrorMessage(messages.noMenu, {
        class: "LunchReminders",
        function: "create()",
        menuTag: this.settings.menuTag,
        menuDraftUUID: this.settings.menuDraftUUID,
      });
    }

    const days = LunchReminders.upcomingDays(LunchMenu.parse(this.menuDraft.content), now, reminderTime);
    if (days.length == 0) return this.#ui.displayAppMessage("info", messages.noDays);

    const picked = this.#promptForDays(days);
    if (picked.length == 0) return context.cancel("No days picked");

    const todos = picked.map((day) => this.#todo(day));
    if (!new ThingsParser().send(todos)) return this.#ui.displayErrorMessage(messages.thingsFailed);

    this.#ui.displaySuccessMessage(messages.added.replace("[[count]]", todos.length));
    return true;
  }

  // Shows the days with checkboxes and returns the ones picked, in week order.
  #promptForDays(days) {
    const labels = days.map(LunchReminders.dayLabel);
    const menuItems = [
      { type: "select", data: { name: "days", label: "", values: labels, allowMultiple: true } },
      { type: "button", data: { name: "Add Reminders", value: "add", isDefault: true } },
    ];

    const menu = this.#ui.buildMenu({ ...this.settings.dayMenu, menuItems });
    if (!menu.show()) return [];

    const chosen = menu.fieldValues.days ?? [];
    return days.filter((day) => chosen.includes(LunchReminders.dayLabel(day)));
  }

  #todo(day) {
    const todo = TJSTodo.create();
    todo.title = this.settings.taskTitle;
    todo.when = LunchReminders.thingsWhen(day.date, this.settings.reminderTime);
    todo.notes = day.notes;
    // A to-do goes in an area through its list.
    if (this.settings.area) todo.list = this.settings.area;
    return todo;
  }
}
