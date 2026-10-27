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
  static fieldTags = {
    when: ["when", "defer"],
    deadline: ["due", "deadline"],
    heading: ["heading"],
    list: ["list", "project"],
    listID: ["listID", "listid"],
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
  static checkboxPattern = /^\s*(?:[-*+]|\d+\.)\s+\[ \]\s?(.*?)\r?$/;
  // The @tags this class reads. Only these come off a checkbox's title; any
  // other @word stays in it.
  static attributeNames = [...Object.values(this.fieldTags), ...Object.values(this.statusTags), ["tag", "tags"]].flat();
  static attributePattern = new RegExp(String.raw`(^|\s)@(${this.attributeNames.join("|")})(?:\(([^)]*)\))?(?=\s|$)`, "g");

  // Turns the open Markdown checkboxes in text into TaskPaper to-dos, e.g.
  // "- [ ] Buy milk #errands @when(today)" becomes
  // "- Buy milk @tags(errands) @when(today)". Returns the to-dos and the text
  // without the checkbox lines. Blank checkboxes are removed but make no to-do.
  static fromChecklist(text) {
    const todos = [];
    const remaining = [];
    for (const line of text.split("\n")) {
      const checkbox = line.match(ThingsParser.checkboxPattern);
      if (!checkbox) {
        remaining.push(line);
        continue;
      }
      const todo = ThingsParser.#checkboxTodo(checkbox[1]);
      if (todo) todos.push(todo);
    }
    return { todos: todos.join("\n"), text: remaining.join("\n") };
  }

  // "#" starts a tag, which runs to the next "#". The @tags this class reads
  // move to the end of the line, and a written @tag(...) joins the #tags.
  static #checkboxTodo(body) {
    const attributes = [];
    const tags = [];
    for (const [, , name, value = ""] of body.matchAll(ThingsParser.attributePattern)) {
      if (name == "tag" || name == "tags") tags.push(...value.split(","));
      else attributes.push(value ? `@${name}(${value})` : `@${name}`);
    }

    const [rawTitle, ...hashTags] = body.replace(ThingsParser.attributePattern, "$1").split("#");
    const title = rawTitle.replace(/\s+/g, " ").trim();
    if (!title) return null;

    const tagList = [...tags, ...hashTags].map((tag) => tag.trim()).filter(Boolean);
    if (tagList.length) attributes.unshift(`@tags(${tagList.join(", ")})`);
    return ["-", title, ...attributes].join(" ");
  }

  // Returns the outline's top-level projects and to-dos, in order.
  parse(text) {
    const outline = birchoutline.Outline.createTaskPaperOutline(text);
    return outline.root.children.map((item) => this.#topLevel(item)).filter(Boolean);
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
    if (this.#isType(item, "task")) return this.#todo(item);
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
      if (this.#isType(child, "task")) project.addTodo(this.#todo(child));
      if (this.#isType(child, "note")) notes.push(child);
      if (this.#isType(child, "project")) {
        this.#addHeading(project, child);
        notes.push(...child.children);
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
      if (!this.#isType(child, "task")) continue;
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
      if (this.#isType(child, "task")) todo.addChecklistItem(this.#checklistItem(child));
    }
    this.#setNotes(todo, item.children);
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

  // Joins the notes among items. Birch reads blank lines as empty notes, so
  // blank lines before and after the text are dropped.
  #setNotes(thing, items) {
    const notes = items.filter((item) => this.#isType(item, "note")).map((item) => item.bodyContentString);
    const text = notes.join("\n").trim();
    if (text) thing.notes = text;
  }

  #title(item) {
    return item.bodyContentString.trim();
  }

  #isType(item, type) {
    return item.getAttribute("data-type") == type;
  }
}
