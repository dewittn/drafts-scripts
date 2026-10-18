// Contact details by initials, from bvr/staff.json (rendered from
// staff.yaml.tpl, the one BVR file with personal details). Every other
// setting names people by initials and resolves them here.
class Staff {
  #people;

  // people: { AG: { name, cell, email }, ... }
  constructor(people = {}) {
    this.#people = people;
  }

  static load(path) {
    if (typeof DataFile == "undefined") require("modules/cp/filesystems/CloudFS.js");
    const data = DataFile.load(path);
    return new Staff(data?.people);
  }

  // "ag, HM; wk" → ["AG", "HM", "WK"]: split on commas, semicolons, or
  // spaces, uppercased, without repeats.
  static parseInitials(text) {
    const parts = `${text || ""}`.split(/[\s,;]+/).map((part) => part.trim().toUpperCase());
    return [...new Set(parts.filter((part) => part != ""))];
  }

  // The initials in a list that no one in the directory has.
  unknown(initialsList) {
    return initialsList.filter((initials) => !this.has(initials));
  }

  has(initials) {
    return this.#people[initials] != undefined;
  }

  // One field (name, cell, or email) for one person. Throws naming the
  // initials when the person or the field is missing.
  contact(initials, field) {
    return this.contacts([initials], field)[0];
  }

  // The same field for a list of people, in order. Throws once, naming every
  // initial that is missing, so a typo in teams.yaml is easy to find.
  contacts(initialsList, field) {
    const missing = initialsList.filter((initials) => !this.has(initials));
    if (missing.length > 0) {
      throw new Error(`No one in staff.yaml.tpl has the initials ${missing.join(", ")}`);
    }

    const lacking = initialsList.filter((initials) => !this.#people[initials][field]);
    if (lacking.length > 0) {
      throw new Error(`staff.yaml.tpl has no ${field} for ${lacking.join(", ")}`);
    }

    return initialsList.map((initials) => this.#people[initials][field]);
  }
}
