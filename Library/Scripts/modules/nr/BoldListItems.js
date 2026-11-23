// Bolds the short label that leads a list item, so notes like
// "- Evernote. They do a good job…" read as "- **Evernote.** They do a good job…".
//
// A label is the words before the item's first colon or spaced dash, or before
// a period when those words are written like a name ("Evernote.", "Turning
// Point."). A period after ordinary words just ends a sentence, so it is left
// alone. The label always needs more text after it, except a colon label that
// heads a sub-list ("- Goals:").
class BoldListItems {
  static defaults = {
    separators: ".:-", // which of period, colon and dash mark a label
    periodNamesOnly: true, // false bolds the words before any period
    maxWords: null, // a number caps how many words a label may have
  };

  // A word starts with a letter or digit in any language, and may contain
  // apostrophes, hyphens and parentheses ("Don't", "e-mail", "Bogotá",
  // "Update(s)"). It may also open with a parenthesis, as in "Notes (draft):".
  // A period inside a word is kept ("Coto.Studio"); one at the end is a
  // separator, so it is never part of the word.
  static wordChars = "[\\p{L}\\p{N}_'’()-]";
  static word = `[\\p{L}\\p{N}_(]${BoldListItems.wordChars}*(?:\\.${BoldListItems.wordChars}+)*`;

  // "- ", "* ", "+ ", "1. " or "1) ", indented or not, and not already bold.
  static marker = /^(\s*(?:[-*+]|\d+[.)])\s+)(?!\*\*|__)/;

  // Lowercase words a name may still contain after its first word, as in
  // "Lord of the Rings" or "El Archivo en Vivo".
  static smallWords = new Set(
    "a an and as at but by de del el en for from in into la las los nor of on or the to vs with y".split(" ")
  );

  constructor(options = {}) {
    const { separators, periodNamesOnly, maxWords } = { ...BoldListItems.defaults, ...options };
    const words = BoldListItems.wordsPattern(maxWords);
    const rules = {
      ".": {
        pattern: new RegExp(`^(${words})\\.(?=\\s+\\S)`, "u"), // "Evernote. They do…"
        accepts: (label) => !periodNamesOnly || BoldListItems.isName(label),
      },
      ":": { pattern: new RegExp(`^(${words}):(?=\\s|$)`, "u"), accepts: () => true }, // "Resolution: With…"
      "-": { pattern: new RegExp(`^(${words})(?=\\s+[-–—]\\s)`, "u"), accepts: () => true }, // "Complication - the…"
    };
    this.rules = Object.keys(rules)
      .filter((symbol) => separators.includes(symbol))
      .map((symbol) => rules[symbol]);
  }

  // One word, then any number of words after it, or up to maxWords in all.
  static wordsPattern(maxWords) {
    const more = maxWords ? `{0,${maxWords - 1}}` : "*";
    return `${BoldListItems.word}(?: ${BoldListItems.word})${more}`;
  }

  // True when the words read like a name or title: each starts with a capital
  // or digit or has a capital inside ("iPhone"), apart from small words such
  // as "of" after the first word.
  static isName(label) {
    return label
      .split(" ")
      .every((word, index) => /^\p{N}|\p{Lu}/u.test(word) || (index > 0 && BoldListItems.smallWords.has(word)));
  }

  // Bolds the label of every list item in text, leaving fenced code alone.
  text(text) {
    let inCode = false;
    return text
      .split("\n")
      .map((line) => {
        if (/^\s*(```|~~~)/.test(line)) inCode = !inCode;
        return inCode ? line : this.line(line);
      })
      .join("\n");
  }

  // One line with its label bolded, or unchanged when it has none.
  line(line) {
    const marker = line.match(BoldListItems.marker)?.[1];
    if (marker == null) return line;

    const rest = line.slice(marker.length);
    const label = this.labelIn(rest);
    if (!label) return line;

    return `${marker}**${label}**${rest.slice(label.length)}`;
  }

  // The label that starts an item's text, or null when it has none.
  labelIn(rest) {
    for (const { pattern, accepts } of this.rules) {
      const match = rest.match(pattern);
      if (match && accepts(match[1])) return match[0];
    }
    return null;
  }
}
