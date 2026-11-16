// Reads a weekly lunch menu draft into one entry per school day.
//
// The draft looks like:
//
//   # Lunch Menu: Nov 16 to Nov 20, 2026
//   ----
//   ## Monday, November 16
//   **Main Entree**
//   - Sweet Thai Chili Spiced Chicken Thigh
//
//   **Sides**
//   - Jasmine Rice
//
// Day headers carry no year, so it comes from the title. A day with no
// "- " items (no school) is still returned, with an empty items list.
class LunchMenu {
  static months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  // Items the menu site posts as a picture only. They name no food.
  static imageOnly = /^\(image only/i;

  // The menu draft: the open draft when it has menuTag, then menuDraftUUID
  // when set, then the newest draft with menuTag (a new one comes each week).
  static find({ menuTag, menuDraftUUID }) {
    const openDraft = typeof draft == "undefined" ? undefined : draft;
    if (openDraft?.hasTag(menuTag)) return openDraft;

    const byUUID = menuDraftUUID ? Draft.find(menuDraftUUID) : undefined;
    return byUUID ?? Draft.query("", "all", [menuTag], [], "created", true)[0];
  }

  // The day in days that falls on date, if any.
  static dayOn(days, date) {
    return days.find((day) => day.date.toDateString() == date.toDateString());
  }

  // Returns [{ date, weekday, items, notes }] in draft order, or [] when the
  // title has no week in it.
  static parse(content = "") {
    const week = LunchMenu.week(content);
    if (week == undefined) return [];

    return LunchMenu.daySections(content)
      .map((section) => LunchMenu.#day(section, week))
      .filter(Boolean);
  }

  // The month and year the week in the title starts in. The title gives only
  // the end year, so "Dec 28 to Jan 1, 2027" starts in December 2026.
  static week(content) {
    const match = content.match(/^#\s.*?(\w{3})\w*\s+\d+\s+to\s+(\w{3})\w*\s+\d+,\s*(\d{4})/m);
    if (match == null) return undefined;

    const [, start, end, year] = match;
    const startMonth = LunchMenu.monthIndex(start);
    const wraps = LunchMenu.monthIndex(end) < startMonth;
    return { startMonth, startYear: Number(year) - (wraps ? 1 : 0) };
  }

  static monthIndex(name = "") {
    return LunchMenu.months.indexOf(name.slice(0, 3).toLowerCase());
  }

  // Each "## Weekday, Month Day" header with the lines under it.
  static daySections(content) {
    return content
      .split(/^(?=##\s)/m)
      .filter((section) => section.startsWith("## "))
      .map((section) => section.split("\n----")[0]);
  }

  // A day's date, its items without the "- ", and its menu as notes. Bold
  // headings whose items were all left out (like the image-only "Menu") go too.
  static #day(section, { startMonth, startYear }) {
    const [header, ...lines] = section.trim().split("\n");
    const match = header.match(/^##\s+(\w+),\s+(\w+)\s+(\d+)/);
    if (match == null) return null;

    const [, weekday, monthName, dayNumber] = match;
    const month = LunchMenu.monthIndex(monthName);
    const year = month < startMonth ? startYear + 1 : startYear;

    const blocks = LunchMenu.#blocks(lines);
    return {
      date: new Date(year, month, Number(dayNumber)),
      weekday,
      items: blocks.flatMap((block) => block.items),
      notes: blocks.map((block) => [block.heading, ...block.items.map((item) => `- ${item}`)].filter(Boolean).join("\n")).join("\n\n"),
    };
  }

  // Groups lines into { heading, items } blocks split by blank lines, keeping
  // only blocks that still have an item.
  static #blocks(lines) {
    return lines
      .join("\n")
      .split(/\n\s*\n/)
      .map((block) => {
        const blockLines = block.trim().split("\n").map((line) => line.trim());
        const heading = blockLines.find((line) => !line.startsWith("- ")) ?? "";
        const items = blockLines
          .filter((line) => line.startsWith("- "))
          .map((line) => line.slice(2).trim())
          .filter((item) => item != "" && !LunchMenu.imageOnly.test(item));
        return { heading, items };
      })
      .filter((block) => block.items.length > 0);
  }
}
