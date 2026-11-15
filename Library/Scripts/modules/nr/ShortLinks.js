if (typeof LinkShortener == "undefined") require("shared/libraries/kutt.js");

// The Shorten Link, Find Short Link, Edit Short Link and Sync Kutt Links
// actions. Links are looked up in the local cache (links.json) first and only
// sent to Kutt when missing. All but Sync also run a full sync once the last
// one is `syncAfterDays` old.
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

    const { target, domain, description } = answer;
    if (!LinkShortener.isURL(target)) return this.#fail(this.#message("invalidURL", { url: target }));
    if (this.shortener.isShortLink(target)) return this.#fail(this.#message("alreadyShort", { url: target }));

    this.#syncIfStale();
    const result = this.shortener.shorten(target, { domain, description });
    if (!result.link) return this.#fail(result.error ?? "Kutt did not return a short link.");

    return this.#deliver(result.link);
  }

  // Lets you pick a saved link from the search page, then inserts its short
  // link at the cursor and copies it. Returns the short link, or false when
  // nothing was chosen.
  findPrompted() {
    const link = this.#pickLink();
    return link ? this.#deliver(link.link) : false;
  }

  // Lets you pick a saved link from the search page, then change its page
  // URL, short address or description, or delete it. Returns the updated
  // short link, or false when nothing was changed.
  editPrompted() {
    const link = this.#pickLink();
    if (!link) return false;

    const answer = this.#askForChanges(link);
    if (answer == undefined) return false;
    if (answer.button == "delete") return this.#deleteLink(link);

    const { changes } = answer;
    if (Object.keys(changes).length == 0) {
      this.#ui.displayAppMessage("info", this.#message("noChanges", {}));
      return false;
    }

    const { target } = changes;
    if (target && !LinkShortener.isURL(target)) return this.#fail(this.#message("invalidURL", { url: target }));
    if (target && this.shortener.isShortLink(target)) return this.#fail(this.#message("alreadyShort", { url: target }));

    const result = this.shortener.update(link, changes);
    if (result.success === false) return this.#fail(result.error);

    this.#ui.displayAppMessage("success", this.#message("updated", { link: result.link }));
    return result.link;
  }

  // Replaces the local cache with every link on Kutt.
  sync() {
    const result = this.shortener.sync();
    if (!result.success) return this.#fail(result.error);

    this.#ui.displayAppMessage("success", this.#message("synced", { count: result.count }));
    return result.count;
  }

  // Shows the saved links in the search page and returns the one picked.
  // Cancels the action and returns undefined when nothing is picked.
  #pickLink() {
    this.#syncIfStale();
    const links = this.shortener.links;
    if (links.length == 0) {
      this.#fail(this.#message("noLinks", {}));
      return undefined;
    }

    const preview = HTMLPreview.create();
    const chosen = preview.show(this.#findLinkHTML(links)) ? context.previewValues?.["link"] : undefined;
    const link = chosen ? this.shortener.byShortLink(chosen) : undefined;
    if (!link) context.cancel();
    return link;
  }

  // Asks first, then deletes the link on Kutt and from the cache. Returns
  // false, since there is no short link left to return.
  #deleteLink(link) {
    const confirm = JSON.parse(JSON.stringify(this.#settings.deleteConfirm));
    confirm.menuMessage = confirm.menuMessage.replaceAll("[[link]]", () => link.link);
    if (this.#ui.yesNoPrompt(confirm) != "yes") {
      context.cancel();
      return false;
    }

    const result = this.shortener.delete(link);
    if (result.success === false) return this.#fail(result.error);

    this.#ui.displayAppMessage("success", this.#message("deleted", { link: link.link }));
    return false;
  }

  // Shows the edit prompt filled in from the link. Returns the button pressed
  // and the fields that were changed, trimmed (blank ones are left out, since
  // Kutt ignores them): { button, changes }. Undefined when cancelled.
  #askForChanges(link) {
    const menuSettings = JSON.parse(JSON.stringify(this.#settings.editPrompt));
    menuSettings.menuMessage = menuSettings.menuMessage.replaceAll("[[link]]", () => link.link);
    const fields = menuSettings.menuItems.filter((item) => item.type == "textField");
    fields.forEach((item) => (item.data.initialText = link[item.data.name] ?? ""));

    const menu = this.#ui.buildMenu(menuSettings);
    if (!menu.show()) {
      context.cancel();
      return undefined;
    }

    const changes = {};
    for (const { data } of fields) {
      const value = String(menu.fieldValues[data.name] ?? "").trim();
      if (value && value != (link[data.name] ?? "")) changes[data.name] = value;
    }
    return { button: menu.buttonPressed, changes };
  }

  // Inserts a short link at the cursor, copies it, and says so.
  #deliver(link) {
    this.#ui.insertAtCursor(link);
    app.setClipboard(link);
    this.#ui.displayAppMessage("success", this.#message("shortened", { link }));
    return link;
  }

  // The Find Short Link page with the links filled in, newest first. "<" is
  // escaped so a link cannot close the page's <script> tag.
  #findLinkHTML(links) {
    const newestFirst = [...links].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const data = newestFirst.map(({ link, target, description }) => ({ link, target, description }));
    const json = JSON.stringify(data).replaceAll("<", "\\u003c");
    return fetchTemplate(this.#settings.findLink.template).replace("[[links]]", () => json);
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
  // copied). Returns { target, domain, description }, or undefined when
  // cancelled.
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
    const description = String(menu.fieldValues["description"] ?? "").trim();
    const pickedRow = domainMenu ? menu.fieldValues[domainMenu.data.name]?.[0] : undefined;
    return { target, domain: domains[pickedRow ?? 0], description };
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
