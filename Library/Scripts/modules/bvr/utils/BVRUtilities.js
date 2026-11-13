class BVRUtilities {
  constructor() {}

  formatDateYMD(date) {
    const { day, month, year } = this.#deconstructDate(date);

    return `${year}-${month}-${day}`;
  }

  // "2026-09-07" as a local date (new Date("2026-09-07") would be UTC
  // midnight, the day before in US time zones). Undefined for no date.
  static parseDateYMD(value) {
    if (!value) return undefined;
    const [year, month, day] = `${value}`.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  // School years start July 1, so a spring date belongs to the year that
  // began the previous fall. The school year is named by its fall year.
  static schoolYear(date) {
    return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  }

  // Which school year today is, counting the one that holds startDate
  // ("YYYY-MM-DD") as year 1. Undefined for no start date.
  static schoolYearCount(startDate, today = new Date()) {
    const start = BVRUtilities.parseDateYMD(startDate);
    if (start == undefined) return undefined;
    return BVRUtilities.schoolYear(today) - BVRUtilities.schoolYear(start) + 1;
  }

  // 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd".
  static ordinal(number) {
    const lastTwo = number % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${number}th`;
    const suffixes = { 1: "st", 2: "nd", 3: "rd" };
    return `${number}${suffixes[number % 10] || "th"}`;
  }

  // { tag: "YYYY-MM-DD" } → { tag: "9th" }: each tag becomes which school
  // year today is since its start date, for "my 9th year coaching" lines.
  static yearCountTags(startDates = {}, today = new Date()) {
    const tags = {};
    for (const [tag, startDate] of Object.entries(startDates)) {
      const count = BVRUtilities.schoolYearCount(startDate, today);
      if (count != undefined) tags[tag] = BVRUtilities.ordinal(count);
    }
    return tags;
  }

  formatDateMDY(date) {
    const { day, month, year } = this.#deconstructDate(date);

    return `${month}-${day}-${year}`;
  }

  cleanUpName(text) {
    const regex = /(?<=\]).*?(?=\(|$)/;

    const textToClean = text.match(regex)[0];
    return textToClean.replace(/\*/g, "").trim();
  }

  getMonth(d = new Date()) {
    const month = d.getMonth() + 1;
    if (month < 10) return `0${month}`;
    return month;
  }

  getDay(d = new Date()) {
    const day = d.getDate();
    if (day < 10) return `0${day}`;
    return day;
  }

  getYear(d = new Date()) {
    return d.getFullYear();
  }

  #deconstructDate(date) {
    return { day: this.getDay(date), month: this.getMonth(date), year: this.getYear(date) };
  }
}
