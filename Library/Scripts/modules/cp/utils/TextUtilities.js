class TextUtilities {
  constructor() {}

  // Converts string to Title Case
  titleCase(string) {
    if (string == undefined) return undefined;

    return string
      .toLowerCase()
      .split(/([\s.\/])/g)
      .map((str) => this.capitalize(str))
      .join("");
  }

  // Converts a title to slug by replacing ' ' with '-'
  convertTitleToSlug(title) {
    if (title == undefined) return "";

    const removeChars = new RegExp(/[:\\"'\\?\\(\\)-,]/, "g");
    return title.toLowerCase().replace(removeChars, "").replace(/[ ]+/g, "-");
  }

  // Removes destination prefixes from Title
  scrubTitle(title, scrubText) {
    if (scrubText == undefined) return title;

    const regEx = new RegExp(scrubText, "ig");
    return title.replace(regEx, "");
  }

  capitalize(string) {
    return string.replace(/\w\S*/g, (w) => w.replace(/^\w/, (c) => c.toUpperCase()));
  }

  capitalizeTags(tags) {
    return tags.map((tag) => this.capitalize(tag));
  }

  // Converts CriticMarkup into Markdown XL for Ulysses. Highlights become ::,
  // comments ++ and deletions ||. Additions keep their text, and substitutions
  // keep only the new text. Padding spaces inside a mark are dropped, and empty
  // marks are removed.
  convertMarkdown(content) {
    const marks = [
      { open: "{==", close: "==}", toXL: (text) => `::${text}::` },
      { open: "{>>", close: "<<}", toXL: (text) => `++${text}++` },
      { open: "{--", close: "--}", toXL: (text) => `||${text}||` },
      { open: "{++", close: "++}", toXL: (text) => text },
    ];

    let converted = content;
    for (const { open, close, toXL } of marks) {
      const pattern = TextUtilities.#markPattern(open, close);
      converted = converted.replace(pattern, (match, text) => (text == "" ? "" : toXL(text)));
    }

    return TextUtilities.#convertSubstitutions(converted);
  }

  // Matches one mark, with an optional padding space after the opening
  // delimiter and before the closing one. Like CriticMarkup.pattern, the text
  // inside may not hold another opening delimiter.
  static #markPattern(open, close) {
    const body = TextUtilities.#unopenedText(open);
    return new RegExp(`${TextUtilities.#escape(open)} ?(${body}) ?${TextUtilities.#escape(close)}`, "g");
  }

  // Substitutions keep only the new text after ~>. A substitution with no ~>
  // keeps its text.
  static #convertSubstitutions(content) {
    const open = TextUtilities.#escape("{~~");
    const close = TextUtilities.#escape("~~}");
    const body = TextUtilities.#unopenedText("{~~", "~~}");
    const withMiddle = new RegExp(`${open} ?${body}~> ?(${body}) ?${close}`, "g");
    const withoutMiddle = new RegExp(`${open} ?(${body}) ?${close}`, "g");

    return content.replace(withMiddle, (match, newText) => newText).replace(withoutMiddle, (match, text) => text);
  }

  // Text that stops before an opening or closing delimiter, so a mark can't run
  // into the next one.
  static #unopenedText(...delimiters) {
    const stops = delimiters.map((delimiter) => `(?!${TextUtilities.#escape(delimiter)})`).join("");
    return `(?:${stops}[\\s\\S])*?`;
  }

  static #escape(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
