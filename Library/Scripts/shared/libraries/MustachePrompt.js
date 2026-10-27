// Prompts for each {{variable}} in a Mustache template, then renders it.
//
// Tag forms, all optional and combinable:
//   {{name}}           text field
//   {{date:name}}      date picker, rendered with dateFormat
//   {{bool:name}}      switch, for {{#name}}...{{/name}} sections
//   {{#name}}          section; a comma list typed in becomes an array
//   {{^name}}          inverted section
//   {{date:name+1w}}   the date offset by days (d), weeks (w), or months (m)
//
// Adapted from Things Parser 3 by pdavisonreiber.
class MustachePrompt {
  static variablePattern = /{{(?:(date|bool):)?([#^])?(\w+)\??([+-]\d+[dwm])?}}/g;
  static offsetPattern = /([+-])(\d+)([dwm])/;
  static fieldTypes = { text: "textField", date: "datePicker", bool: "switch" };
  static fieldDefaults = { text: {}, date: { options: { mode: "date" } }, bool: { initialValue: false } };

  #ui;
  #dateFormat;
  #title;

  constructor(ui, { dateFormat = "%Y-%m-%d", title = "Fill in the template" } = {}) {
    this.#ui = ui;
    this.#dateFormat = dateFormat;
    this.#title = title;
  }

  // Returns the rendered text, the text unchanged when it has no variables,
  // or null when the prompt is cancelled.
  render(text) {
    const variables = MustachePrompt.findVariables(text);
    if (variables.size == 0) return text;

    const prompt = this.#ui.buildMenu(this.#menu(variables));
    if (!prompt.show()) return null;

    const template = MustacheTemplate.createWithTemplate(MustachePrompt.plainTags(text, variables));
    template.contentType = "text";
    return template.render(this.#values(variables, prompt.fieldValues));
  }

  // Maps each variable name to its type, whether any tag opens it as a {{#section}},
  // and every tag that uses it. The first tag that gives a type sets it.
  static findVariables(text) {
    const variables = new Map();
    for (const [tag, type, modifier, name, offset] of text.matchAll(MustachePrompt.variablePattern)) {
      const variable = variables.get(name) ?? { name, tags: [] };
      variable.type ??= type;
      variable.isSection ||= modifier == "#";
      variable.tags.push({ tag, type, offset });
      variables.set(name, variable);
    }
    return variables;
  }

  // Rewrites tags into plain Mustache: drops the "date:" or "bool:" prefix and
  // points offset tags at their own value, e.g. {{date:due-1d}} becomes
  // {{due_offset_backwards_1d}}.
  static plainTags(text, variables) {
    for (const variable of variables.values()) {
      for (const { tag, type, offset } of variable.tags) {
        let plain = type ? tag.replace(`${type}:`, "") : tag;
        if (offset) plain = plain.replace(offset, MustachePrompt.offsetKey(offset));
        text = text.replaceAll(tag, plain);
      }
    }
    return text;
  }

  static offsetKey(offset) {
    return offset.replace("+", "_offset_forward_").replace("-", "_offset_backwards_");
  }

  // Moves a date by an offset like "+3d", "-2w", or "+1m". Adding months keeps
  // the day of the month, or uses the month's last day when it is too short.
  static offsetDate(date, offset) {
    const [, sign, amount, unit] = offset.match(MustachePrompt.offsetPattern);
    const count = (sign == "+" ? 1 : -1) * parseInt(amount);
    const result = new Date(date);

    if (unit == "d") result.setDate(result.getDate() + count);
    if (unit == "w") result.setDate(result.getDate() + count * 7);
    if (unit == "m") {
      const day = result.getDate();
      result.setMonth(result.getMonth() + count);
      if (result.getDate() != day) result.setDate(0);
    }
    return result;
  }

  #menu(variables) {
    const fields = [...variables.values()].map(({ name, type = "text" }) => ({
      type: MustachePrompt.fieldTypes[type],
      data: { name, label: name, ...MustachePrompt.fieldDefaults[type] },
    }));
    const ok = { type: "button", data: { name: "OK", value: "ok", isDefault: true } };
    return { menuTitle: this.#title, menuItems: [...fields, ok] };
  }

  // Turns the prompt's answers into Mustache data, plus one value per offset tag.
  #values(variables, fieldValues) {
    const data = {};
    for (const variable of variables.values()) {
      const value = fieldValues[variable.name];
      data[variable.name] = this.#value(variable, value);

      if (!(value instanceof Date)) continue;
      for (const { offset } of variable.tags.filter((tag) => tag.offset)) {
        const offsetDate = MustachePrompt.offsetDate(value, offset);
        data[variable.name + MustachePrompt.offsetKey(offset)] = strftime(offsetDate, this.#dateFormat);
      }
    }
    return data;
  }

  #value(variable, value) {
    if (value instanceof Date) return strftime(value, this.#dateFormat);
    if (typeof value == "string" && variable.isSection && value.includes(",")) {
      return value.split(",").map((item) => item.trim());
    }
    return value;
  }
}
