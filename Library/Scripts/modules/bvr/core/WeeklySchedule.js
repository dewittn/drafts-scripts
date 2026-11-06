if (typeof Game == "undefined") require("modules/bvr/core/Game.js");
if (typeof TmplSettings == "undefined") require("modules/bvr/utils/TmplSettings.js");
if (typeof Template == "undefined") require("modules/cp/templates/Template.js");

// Builds a team's weekly schedule email from one week of its calendar, one
// line per day: "Monday - practice, 2:35 - 3:35". Prompts and wording live
// under weeklySchedule in ui.yaml; the practice time under weeklySchedule in
// the level or teams.yaml. The template is bvr/weekly-schedule.mustache.
class WeeklySchedule {
  static dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  static monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  static schoolDays = 5;

  #bvr;
  #team;
  #tmplSettings;

  constructor({ bvr, team, tmplSettings }) {
    this.#bvr = bvr;
    this.#team = team;
    this.#tmplSettings = tmplSettings;
  }

  get ui() {
    return this.#bvr.ui;
  }

  // The prompts and wording from ui.yaml, plus the team's practice time.
  get wording() {
    const { wording } = this.ui.settings("weeklySchedule");
    return { ...wording, practiceTime: this.#team.weeklyScheduleSettings.practiceTime };
  }

  // Asks which week (unless given any day in it), reads it from the team's
  // calendar, and opens the email draft.
  create(date) {
    const monday = date == undefined ? this.#pickWeek() : WeeklySchedule.scheduleMonday(date);
    if (monday == undefined) return;

    const calendar = Calendar.find(this.#team.calendar);
    if (calendar == undefined) {
      return this.ui.displayAppMessage("error", `There is no calendar named ${this.#team.calendar}.`);
    }

    const events = calendar.events(monday, WeeklySchedule.addDays(monday, 7));
    const emailDraft = new Template(this.#templateSettings(monday, events));
    emailDraft.archive().save().activate();
  }

  // **********************
  // Static Functions
  // **********************

  // The Monday of the week an email is for: the date's own week on a
  // weekday, and the week ahead on a weekend. Midnight, local time.
  static scheduleMonday(date) {
    const day = date.getDay();
    const offset = day == 0 ? 1 : day == 6 ? 2 : 1 - day;
    return WeeklySchedule.addDays(date, offset);
  }

  // Midnight, local time, `days` after date.
  static addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  // "Nov 30"
  static shortDate(date) {
    return `${WeeklySchedule.monthNames[date.getMonth()]} ${date.getDate()}`;
  }

  // One { day, description } per day from monday on. A school day with no
  // events gets wording.emptyDay so the gap is easy to spot; a weekend day
  // with no events is left out.
  static buildDays(events, monday, wording) {
    return WeeklySchedule.dayNames
      .map((day, index) => {
        const date = WeeklySchedule.addDays(monday, index);
        const dayEvents = events
          .filter((event) => WeeklySchedule.sameDay(event.startDate, date))
          .sort((a, b) => a.startDate - b.startDate);

        if (dayEvents.length == 0) {
          return index < WeeklySchedule.schoolDays ? { day, description: wording.emptyDay } : undefined;
        }

        const description = dayEvents.map((event) => WeeklySchedule.describeEvent(event, wording)).join("; ");
        return { day, description };
      })
      .filter((line) => line != undefined);
  }

  // One event as the email words it. Games read their field and time from
  // the event notes; "No Practice" reads its reason from them.
  static describeEvent(event, wording) {
    const title = `${event.title || ""}`.trim();
    const notes = `${event.notes || ""}`.trim();

    if (title.toLowerCase() == "no practice") {
      return notes == ""
        ? wording.noPractice
        : WeeklySchedule.fill(wording.noPracticeWithReason, { reason: notes });
    }

    const game = Game.parseCalendarTitle(title);
    if (game != undefined) {
      const details = notes == "" ? wording.missingGameDetails : notes;
      return WeeklySchedule.fill(wording.game, { ...game, details });
    }

    if (title.toLowerCase() == "practice") {
      const time = wording.practiceTime || WeeklySchedule.timeRange(event);
      return WeeklySchedule.fill(wording.practice, { time });
    }

    // Anything else: its title and time, as on the calendar.
    return event.isAllDay ? title : `${title}, ${WeeklySchedule.timeRange(event)}`;
  }

  // "2:20 - 3:35", on a 12-hour clock.
  static timeRange(event) {
    const clock = (date) => {
      const hours = date.getHours() % 12 || 12;
      return `${hours}:${`${date.getMinutes()}`.padStart(2, "0")}`;
    };
    return `${clock(event.startDate)} - ${clock(event.endDate)}`;
  }

  // "Coach Koch", "Coach Koch and Coach Nelson", "A, B and C".
  static signOff(names) {
    if (names.length <= 1) return names.join("");
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }

  // Swaps {name} in wording for values.name.
  static fill(text, values) {
    return `${text}`.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
  }

  static sameDay(a, b) {
    return a.getFullYear() == b.getFullYear() && a.getMonth() == b.getMonth() && a.getDate() == b.getDate();
  }

  // **********************
  // Private Functions
  // **********************

  // "This Coming Week" or a date picked in any day of the wanted week.
  #pickWeek() {
    const { weekMenu, datePrompt } = this.ui.settingsCopy("weeklySchedule");
    const weekPrompt = this.ui.buildMenu(weekMenu);
    if (weekPrompt.show() == false) return undefined;

    const comingWeek = weekMenu.menuItems[0]?.data?.value;
    if (weekPrompt.buttonPressed == comingWeek) return WeeklySchedule.scheduleMonday(new Date());

    const picker = this.ui.buildMenu(datePrompt);
    if (picker.show() == false) return undefined;

    const fieldName = datePrompt.menuItems[0]?.data?.name;
    return WeeklySchedule.scheduleMonday(picker.fieldValues[fieldName]);
  }

  // The template settings, with the week's days and the sign-off added to
  // the team tags every BVR template gets.
  #templateSettings(monday, events) {
    const gblTmplSettings = this.#team.gblTmplSettings;
    const teamTemplateTags = {
      ...gblTmplSettings.teamTemplateTags,
      week_of: WeeklySchedule.shortDate(monday),
      schedule_days: WeeklySchedule.buildDays(events, monday, this.wording),
      coach_sign_off: WeeklySchedule.signOff(this.#team.coachNames),
    };
    return new TmplSettings({ ...gblTmplSettings, teamTemplateTags }, this.#tmplSettings.weeklySchedule);
  }
}
