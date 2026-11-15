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

  // Which year today is, counting from startDate ("YYYY-MM-DD") as year 1.
  // Each anniversary of the date starts the next year. Undefined for no date
  // or one still to come.
  static yearCount(startDate, today = new Date()) {
    const start = BVRUtilities.parseDateYMD(startDate);
    if (start == undefined) return undefined;
    const beforeAnniversary =
      today.getMonth() < start.getMonth() ||
      (today.getMonth() == start.getMonth() && today.getDate() < start.getDate());
    const fullYears = today.getFullYear() - start.getFullYear() - (beforeAnniversary ? 1 : 0);
    return fullYears < 0 ? undefined : fullYears + 1;
  }

  // 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd".
  static ordinal(number) {
    const lastTwo = number % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${number}th`;
    const suffixes = { 1: "st", 2: "nd", 3: "rd" };
    return `${number}${suffixes[number % 10] || "th"}`;
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
