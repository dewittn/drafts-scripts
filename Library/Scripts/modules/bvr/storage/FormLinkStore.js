if (typeof DataFile == "undefined") require("modules/cp/filesystems/CloudFS.js");

// Score-form links shared by every team in a term, kept in bvr/formLinks.json:
// { schemaVersion: 1, terms: { "2026-fall": { "<form name>": url } } }.
// The athletic department issues one link per form per term each year, so a
// link pasted by one fall team serves every fall team. Written by Drafts in
// iCloud like the team files; never pushed by the build.
class FormLinkStore {
  static schemaVersion = 1;
  #file;

  // file: the parsed links file with a save() method (a DataFile in Drafts).
  constructor(file) {
    this.#file = file;
  }

  // The shared links. A missing file starts empty, and it and its folder are
  // written on the first save. A file that exists but is not usable (a
  // half-synced iCloud copy reads as empty) throws, so it is never overwritten.
  static load(path) {
    const file = DataFile.loadValidated(path, (data) => this.validate(data));
    if (file != undefined) return new FormLinkStore(file);
    return new FormLinkStore(DataFile.create(path, { schemaVersion: this.schemaVersion, terms: {} }));
  }

  // Why data is not a usable links file, or undefined when it is.
  static validate(data) {
    const isObject = DataFile.isObject;
    if (!isObject(data)) return "the file is empty or not a JSON object";
    if (data.schemaVersion !== this.schemaVersion) return `unknown schemaVersion ${JSON.stringify(data.schemaVersion)}`;
    if (!isObject(data.terms)) return "terms is missing or not an object";
    const badTerm = Object.keys(data.terms).find((term) => !isObject(data.terms[term]));
    if (badTerm != undefined) return `term ${badTerm} is not an object`;
    return undefined;
  }

  // The term a season belongs to: its ID when that is <year>-fall, -winter,
  // or -spring (any case), lowercased. Other IDs (2026-27) have no term and
  // keep their links on the season.
  static termFor(seasonID) {
    const match = /^(\d{4})-(fall|winter|spring)$/i.exec(`${seasonID}`);
    return match == null ? undefined : `${match[1]}-${match[2].toLowerCase()}`;
  }

  link(term, formName) {
    return this.#file.terms?.[term]?.[formName];
  }

  setLink(term, formName, url) {
    this.#file.terms[term] = { ...(this.#file.terms[term] || {}), [formName]: url };
  }

  clearLink(term, formName) {
    if (this.#file.terms[term] != undefined) delete this.#file.terms[term][formName];
  }

  // Refuses to write anything that would not load back.
  save() {
    return DataFile.saveValidated(this.#file, (data) => FormLinkStore.validate(data), "Form links");
  }
}
