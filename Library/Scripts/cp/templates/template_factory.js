require("cp/templates/Template.js");
require("cp/templates/AuthorUpdate.js");
require("cp/templates/BeyondTheBook.js");

class TemplateFactory {
  #ui;
  #settings;

  constructor(dependancies) {
    this.#ui = dependancies.ui;
    this.#settings = dependancies.settings;
  }

  create(settings) {
    const { destination, templateName } = settings;

    switch (templateName) {
      case "authorUpdate":
        return new AuthorUpdate();
      case "beyondTheBook":
        return new BeyondTheBook();
      default:
        // Prompt for title and status of new draft
        const { infoMessage, menuSettings } = this.#settings.createNewDraft;
        const menu = this.#ui.buildMenu(menuSettings);
        if (menu.show() == false) return context.cancel();

        const title = this.#ui.utilities.getTextFieldValueFromMenu(menu);
        const status = menu.buttonPressed;
        return new Template({
          templateFile: "cp/default.md",
          templateTags: {
            title: title,
          },
          draftTags: [status, destination],
        });
    }
  }
}
