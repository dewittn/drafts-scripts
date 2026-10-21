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
