if (typeof EmailDraft == "undefined") require("modules/nr/EmailDraft.js");
if (typeof Template == "undefined") require("modules/cp/templates/Template.js");

// Starts an archived email draft for a person, in the shape EmailDraft reads, so
// Send to Fastmail can pick it up. Asks for the name and address, and asks again when
// the name is blank or the address does not parse. A blank address is allowed:
// Send to Fastmail asks for it later. Wording lives under `newEmail` in
// nr-settings.yaml.
class NewEmail {
  #settings;
  #ui;

  constructor(settings, ui) {
    this.#settings = settings;
    this.#ui = ui;
  }

  get settings() {
    return this.#settings;
  }

  create() {
    const { templateFile, draftTags } = this.settings;
    if (Template.load(templateFile) == undefined) {
      return this.#ui.displayErrorMessage(`Email template "${templateFile}" could not be read!`, {
        class: "NewEmail",
        function: "create()",
        templateFile,
      });
    }

    const person = this.#promptForPerson();
    if (person == undefined) return false;

    return new Template({ templateFile, templateTags: person, draftTags }).archive().save().activate();
  }

  // Returns { name, email }, or undefined on cancel. Each retry keeps what was
  // typed and shows what was wrong with it.
  #promptForPerson(entered = {}, problem = "") {
    const prompt = this.#ui.buildMenu(this.#personMenu(entered, problem));
    if (prompt.show() == false) return undefined;

    const { name = "", email = "" } = prompt.fieldValues;
    const person = { name: name.trim(), email: email.trim() };

    const newProblem = this.#problemWith(person);
    return newProblem ? this.#promptForPerson(person, newProblem) : person;
  }

  // The configured menu with typed values filled in. Copies items so the
  // settings are not changed.
  #personMenu(entered, problem) {
    const { menuSettings } = this.settings;
    const menuItems = menuSettings.menuItems.map((item) =>
      item.type == "textField" ? { ...item, data: { ...item.data, initialText: entered[item.data.name] ?? "" } } : item,
    );
    return { ...menuSettings, menuMessage: problem || menuSettings.menuMessage, menuItems };
  }

  // What is wrong with the typed values, or "" when they are fine.
  #problemWith({ name, email }) {
    const { messages } = this.settings;
    if (name == "") return messages.missingName;
    if (email != "" && EmailDraft.parseAddress(email) == undefined) {
      return messages.invalidAddress.replace("[[address]]", () => email);
    }
    return "";
  }
}
