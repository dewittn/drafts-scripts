if (typeof Game == "undefined") require("modules/bvr/core/Game.js");
if (typeof TmplSettings == "undefined") require("modules/bvr/utils/TmplSettings.js");
if (typeof SeasonRecordTable == "undefined") require("modules/bvr/utils/SeasonRecordTable.js");
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
  #dependencies;

  constructor(dependencies) {
    const { bvr, team, tmplSettings } = dependencies;
    this.#dependencies = dependencies;
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

  // The week before monday's recorded games, one { line } each, and the
  // season record from every game before monday, so an email for a past
  // week shows the record as it stood then. Undefined before the first
  // recorded game, which leaves the template's Last Week list out.
  static lastWeek(games, monday, wording) {
    const played = games.filter((game) => game.recorded && game.date < monday);
    if (played.length == 0) return undefined;

    const weekBefore = WeeklySchedule.addDays(monday, -7);
    const lines = played
      .filter((game) => game.date >= weekBefore)
      .sort((a, b) => a.date - b.date)
      .map((game) => ({ line: WeeklySchedule.describeGame(game, wording) }));

    return {
      games: lines.length > 0 ? lines : [{ line: wording.noGamesLastWeek }],
      record: WeeklySchedule.record(played),
      record_words: WeeklySchedule.recordWords(played),
    };
  }

  // "Friday"
  static dayName(date) {
    return WeeklySchedule.dayNames[(date.getDay() + 6) % 7];
  }

  // "Monday, Win vs Newton, 5 - 2"
  static describeGame(game, wording) {
    const day = WeeklySchedule.dayName(game.date);
    const { result, opponent, fullScore: score } = game;
    return WeeklySchedule.fill(wording.lastWeekGame, { day, result, opponent, score });
  }

  // "5-4", or "5-4-1" once the season has a draw.
  static record(games) {
    const tally = SeasonRecordTable.tally(games);
    return tally.endsWith("-0") ? tally.slice(0, -2) : tally;
  }

  // "7 wins, 2 losses, 1 draw": the record spelled out, for the summary
  // prompt, so the model does not have to guess what "7-2-1" means.
  static recordWords(games) {
    const [wins, losses, draws] = SeasonRecordTable.tally(games).split("-").map(Number);
    const count = (number, word) => `${number} ${word}${number == 1 ? "" : word.endsWith("s") ? "es" : "s"}`;
    const words = [count(wins, "win"), count(losses, "loss")];
    if (draws > 0) words.push(count(draws, "draw"));
    return words.join(", ");
  }

  // The Last Week list as plain text, for the action log:
  //   Last Week:
  //   - Tuesday, Win vs Derby (B), 2 - 1
  //   - Season Record: 7-2-2
  static lastWeekText(lastWeek) {
    const lines = lastWeek.games.map((game) => `- ${game.line}`);
    return ["Last Week:", ...lines, `- Season Record: ${lastWeek.record}`].join("\n");
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

  // The template settings, with the week's days, last week's games, the
  // generated opening, and the sign-off added to the team tags every BVR
  // template gets. Last week's games always go to the action log; the
  // template shows them only when no summary was written.
  #templateSettings(monday, events) {
    const gblTmplSettings = this.#team.gblTmplSettings;
    const weekTags = {
      team_name: this.#team.name,
      schedule_days: WeeklySchedule.buildDays(events, monday, this.wording),
      last_week: WeeklySchedule.lastWeek(this.#seasonGames, monday, this.wording),
    };
    if (weekTags.last_week != undefined) console.log(WeeklySchedule.lastWeekText(weekTags.last_week));

    const teamTemplateTags = {
      ...gblTmplSettings.teamTemplateTags,
      ...weekTags,
      week_of: WeeklySchedule.shortDate(monday),
      // The day the email is written, for "Happy Friday!"
      today: WeeklySchedule.dayName(new Date()),
      summary: this.#summarize(weekTags),
      coach_sign_off: WeeklySchedule.signOff(this.#team.coachNames),
    };
    return new TmplSettings({ ...gblTmplSettings, teamTemplateTags }, this.#tmplSettings.weeklySchedule);
  }

  // A sentence or two on last week and this one, from the model in
  // settings.yaml.tpl's languageModel. Undefined, leaving the template's
  // placeholder, when there is no model set, no game recorded yet, or the
  // model fails (which is reported but does not stop the email).
  #summarize(weekTags) {
    const modelSettings = this.#bvr.settings.languageModel;
    if (modelSettings == undefined || weekTags.last_week == undefined) return undefined;

    if (typeof LanguageModel == "undefined") require("shared/libraries/LanguageModel.js");
    const prompt = WeeklySchedule.renderPrompt(this.#tmplSettings.weeklySchedule.summaryPrompt, weekTags);
    const model = LanguageModel.create(modelSettings);
    const summary = model.respond(prompt);
    if (summary == undefined) {
      this.ui.displayAppMessage("warning", `No summary written: ${model.lastError}`, {
        function: "WeeklySchedule.summarize",
        provider: modelSettings.provider,
        lastError: model.lastError,
      });
    }
    return summary;
  }

  // The summary prompt template, filled in with the week's tags.
  static renderPrompt(templateFile, tags) {
    const mustache = MustacheTemplate.createWithTemplate(Template.load(templateFile));
    mustache.contentType = "text";
    return mustache.render(tags);
  }

  // This season's games from the team file, as Games. None for a team
  // without a current season.
  get #seasonGames() {
    const entries = this.#team.season.currentSeasonRecord || [];
    return entries.map((entry) => Game.fromJSON(this.#dependencies, entry));
  }
}
