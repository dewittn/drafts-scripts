if (typeof LinkShortener == "undefined") require("shared/libraries/kutt.js");

// The Shorten Link and Sync Kutt Links actions. Links are looked up in the
// local cache (links.json) first and only sent to Kutt when missing.
// Prompt wording lives under `kutt` in nr-settings.yaml.
class ShortLinks {
  #settings;
  #ui;
  #shortener;

  // shortener is created on first use, so tests can pass a stub instead.
  constructor(settings, ui, shortener) {
    this.#settings = settings;
    this.#ui = ui;
    this.#shortener = shortener;
  }

  get shortener() {
    if (this.#shortener == undefined) this.#shortener = new LinkShortener();
    return this.#shortener;
  }

  // Asks for a link, shortens it, then inserts the short link at the cursor
  // and copies it. Returns the short link, or false when nothing was made.
  shortenPrompted() {
    const target = this.#askForLink();
    if (target == undefined) return false;

    if (!LinkShortener.isURL(target)) return this.#fail(this.#message("invalidURL", { url: target }));

    const result = this.shortener.shorten(target);
    if (!result?.link) return this.#fail(result?.error ?? "Kutt did not return a short link.");

    this.#ui.insertAtCursor(result.link);
    app.setClipboard(result.link);
    this.#ui.displayAppMessage("success", this.#message("shortened", { link: result.link }));
    return result.link;
  }

  // Replaces the local cache with every link on Kutt.
  sync() {
    const result = this.shortener.sync();
    if (!result.success) return this.#fail(result.error);

    this.#ui.displayAppMessage("success", this.#message("synced", { count: result.count }));
    return result.count;
  }

  // Shows the Shorten Link prompt, starting with the clipboard when it is a
  // link. Returns the trimmed text, or undefined when cancelled.
  #askForLink() {
    const menuSettings = this.#ui.settingsCopy("shortenPrompt");
    const clipboard = app.getClipboard();
    const field = menuSettings.menuItems.find((item) => item.type == "textField");
    if (LinkShortener.isURL(clipboard)) field.data.initialText = clipboard.trim();

    const menu = this.#ui.buildMenu(menuSettings);
    if (!menu.show()) {
      context.cancel();
      return undefined;
    }
    return String(menu.fieldValues[field.data.name] ?? "").trim();
  }

  // Fills [[name]] placeholders in a message from settings.messages.
  #message(name, values) {
    return Object.entries(values).reduce(
      (text, [key, value]) => text.replaceAll(`[[${key}]]`, value),
      this.#settings.messages[name],
    );
  }

  // context.fail shows the message itself and stops the action's later steps.
  #fail(message) {
    context.fail(message);
    return false;
  }
}
