if (typeof LinkShortener == "undefined") require("shared/libraries/kutt.js");

// The Shorten Link and Sync Kutt Links actions. Links are looked up in the
// local cache (links.json) first and only sent to Kutt when missing. Shorten
// Link also runs a full sync once the last one is `syncAfterDays` old.
// Prompt wording and settings live under `kutt` in nr-settings.yaml.
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
    const answer = this.#askForLink();
    if (answer == undefined) return false;

    const { target, domain } = answer;
    if (!LinkShortener.isURL(target)) return this.#fail(this.#message("invalidURL", { url: target }));
    if (this.shortener.isShortLink(target)) return this.#fail(this.#message("alreadyShort", { url: target }));

    this.#syncIfStale();
    const result = this.shortener.shorten(target, domain);
    if (!result.link) return this.#fail(result.error ?? "Kutt did not return a short link.");

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

  // Runs a full sync when the last one is older than syncAfterDays. A failed
  // sync is only logged: the cache still works, and shorten() reports Kutt
  // errors itself.
  #syncIfStale() {
    if (!this.shortener.needsSync(this.#settings.syncAfterDays)) return;

    const result = this.shortener.sync();
    if (!result.success) console.log(`Automatic Kutt sync failed: ${result.error}`);
  }

  // Shows the Shorten Link prompt, starting with the clipboard when it is a
  // link to shorten (not one of our own short links, which the action just
  // copied). Returns { target, domain }, or undefined when cancelled.
  #askForLink() {
    const menuSettings = JSON.parse(JSON.stringify(this.#settings.shortenPrompt));
    const field = menuSettings.menuItems.find((item) => item.type == "textField");
    const clipboard = app.getClipboard();
    if (LinkShortener.isURL(clipboard) && !this.shortener.isShortLink(clipboard)) field.data.initialText = clipboard.trim();

    const domains = this.shortener.domains;
    const domainMenu = this.#fillDomainMenu(menuSettings, domains);

    const menu = this.#ui.buildMenu(menuSettings);
    if (!menu.show()) {
      context.cancel();
      return undefined;
    }

    const target = String(menu.fieldValues[field.data.name] ?? "").trim();
    const pickedRow = domainMenu ? menu.fieldValues[domainMenu.data.name]?.[0] : undefined;
    return { target, domain: domains[pickedRow ?? 0] };
  }

  // Lists the domains in the picker, with Kutt's default chosen. Drops the
  // picker when there is only one domain. Returns the picker, if kept.
  #fillDomainMenu(menuSettings, domains) {
    const index = menuSettings.menuItems.findIndex((item) => item.data.name == "domain");
    if (index == -1) return undefined;

    if (domains.length < 2) {
      menuSettings.menuItems.splice(index, 1);
      return undefined;
    }

    const item = menuSettings.menuItems[index];
    item.data.columns = [domains];
    item.data.selectedRows = [0];
    return item;
  }

  // Fills [[name]] placeholders in a message from settings.messages. The
  // function replacement keeps "$" in the values from being read as a pattern.
  #message(name, values) {
    return Object.entries(values).reduce(
      (text, [key, value]) => text.replaceAll(`[[${key}]]`, () => String(value)),
      this.#settings.messages[name],
    );
  }

  // context.fail shows the message itself and stops the action's later steps.
  #fail(message) {
    context.fail(message);
    return false;
  }
}
