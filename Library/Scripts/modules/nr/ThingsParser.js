if (typeof birchoutline == "undefined") require("vendor/birchoutline.js");

// Turns a TaskPaper outline into Things projects and to-dos.
//
// Top-level "Project:" lines become projects and "- " lines become to-dos.
// Inside a project, a "Heading:" line becomes a heading for the to-dos under
// it. Inside a to-do, "- " lines become checklist items. Plain lines become
// notes. @tags set Things fields, e.g. @when(today) @due(2026-11-01)
// @tags(home, errands) @done.
//
// Adapted from Things Parser 3 by pdavisonreiber.
class ThingsParser {
  // Each Things field and the TaskPaper tags that set it, first match wins.
  // A to-do has no area in Things; it goes in an area through its list.
  static fieldTags = {
    when: ["when", "defer"],
    deadline: ["due", "deadline"],
    heading: ["heading"],
    list: ["list", "project", "area"],
    listID: ["listID", "listid", "areaID", "areaid"],
    area: ["area"],
    areaID: ["areaID", "areaid"],
  };
  static statusTags = {
    canceled: ["canceled", "cancelled"],
    completed: ["completed", "done"],
    archived: ["archived", "done"],
  };
  static todoFields = ["when", "deadline", "heading", "list", "listID"];
  static projectFields = ["when", "deadline", "area", "areaID"];

  // Returns the outline's top-level projects and to-dos, in order.
  parse(text) {
    const outline = birchoutline.Outline.createTaskPaperOutline(text);
    return outline.root.children.map((item) => this.#topLevel(item)).filter(Boolean);
  }

  // The lines parse() has no place for, as typed: top-level lines that are
  // neither a project nor a to-do (like "Buy milk" or "- @tags(home)"), and
  // anything under a blank "- ". Blank lines are left out.
  unsent(text) {
    const outline = birchoutline.Outline.createTaskPaperOutline(text);
    return outline.root.children
      .filter((item) => !this.#isType(item, "project") && !this.#isTask(item))
      .flatMap((item) => [item, ...item.descendants])
      .map((item) => item.bodyString.trim())
      .filter((line) => !["", "-"].includes(line));
  }

  // Opens Things and adds the items, showing the first one.
  open(items) {
    const callback = CallbackURL.create();
    callback.baseURL = TJSContainer.create(items).url;
    callback.addParameter("reveal", true);
    return app.openURL(callback.url);
  }

  // Adds the items in Things and waits for it to return to Drafts, so actions
  // queued after this one run in Drafts. Returns whether it worked.
  send(items) {
    const callback = CallbackURL.create();
    callback.baseURL = TJSContainer.create(items).url;
    return callback.open();
  }

  #topLevel(item) {
    if (this.#isType(item, "project")) return this.#project(item);
    if (this.#isTask(item)) return this.#todo(item);
    return null;
  }

  // Things headings hold no notes, so notes under a heading go on the
  // project, in the order they appear.
  #project(item) {
    const project = TJSProject.create();
    this.#setFields(project, item, ThingsParser.projectFields);
    this.#setStatus(project, item, ["canceled", "completed"]);

    const notes = [];
    for (const child of item.children) {
      if (this.#isTask(child)) project.addTodo(this.#todo(child));
      if (this.#isType(child, "note")) notes.push(child.bodyContentString);
      if (this.#isType(child, "project")) {
        this.#addHeading(project, child);
        notes.push(...this.#notes(child.children));
      }
    }
    this.#setNotes(project, notes);
    return project;
  }

  #addHeading(project, item) {
    const heading = TJSHeading.create();
    heading.title = this.#title(item);
    this.#setStatus(heading, item, ["archived"]);
    project.addHeading(heading);

    for (const child of item.children) {
      if (!this.#isTask(child)) continue;
      const todo = this.#todo(child);
      todo.heading = heading.title;
      project.addTodo(todo);
    }
  }

  #todo(item) {
    const todo = TJSTodo.create();
    this.#setFields(todo, item, ThingsParser.todoFields);
    this.#setStatus(todo, item, ["canceled", "completed"]);

    for (const child of item.children) {
      if (this.#isTask(child)) todo.addChecklistItem(this.#checklistItem(child));
    }

    // Birch reads a note line ending in ":" as a project. A to-do holds no
    // projects, so it stays a note, with any lines under it.
    const notes = item.children.flatMap((child) => {
      if (this.#isType(child, "note")) return [child.bodyContentString];
      if (this.#isType(child, "project")) return [child, ...child.descendants].map((line) => line.bodyString.trim());
      return [];
    });
    this.#setNotes(todo, notes);
    return todo;
  }

  #checklistItem(item) {
    const checklistItem = TJSChecklistItem.create();
    checklistItem.title = this.#title(item);
    this.#setStatus(checklistItem, item, ["canceled", "completed"]);
    return checklistItem;
  }

  // Sets the title, each field the item has a tag for, and its Things tags.
  #setFields(thing, item, fields) {
    thing.title = this.#title(item);
    for (const field of fields) {
      const value = this.#tagValue(item, ThingsParser.fieldTags[field]);
      if (value != undefined) thing[field] = value;
    }

    const tags = this.#tagValue(item, ["tag", "tags"]);
    if (tags != undefined) thing.tags = tags.split(",").map((tag) => tag.trim());
  }

  #setStatus(thing, item, statuses) {
    for (const status of statuses) {
      thing[status] = ThingsParser.statusTags[status].some((tag) => item.hasAttribute(`data-${tag}`));
    }
  }

  #tagValue(item, tags) {
    const tag = tags.find((tag) => item.hasAttribute(`data-${tag}`));
    return tag && item.getAttribute(`data-${tag}`);
  }

  #notes(items) {
    return items.filter((item) => this.#isType(item, "note")).map((item) => item.bodyContentString);
  }

  // Joins the note lines. Birch reads blank lines as empty notes, so blank
  // lines before and after the text are dropped.
  #setNotes(thing, notes) {
    const text = notes.join("\n").trim();
    if (text) thing.notes = text;
  }

  #title(item) {
    return item.bodyContentString.trim();
  }

  #isType(item, type) {
    return item.getAttribute("data-type") == type;
  }

  // A blank "- " line, like the one a template leaves for typing, is no task.
  // Birch keeps the dash as its text, so its title reads "-".
  #isTask(item) {
    return this.#isType(item, "task") && !this.#isBlank(item);
  }

  #isBlank(item) {
    return ["", "-"].includes(this.#title(item));
  }
}
