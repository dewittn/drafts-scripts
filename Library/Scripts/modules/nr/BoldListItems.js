// Bolds the short label that leads a list item, so notes like
// "- Evernote. They do a good job…" read as "- **Evernote.** They do a good job…".
// A label is one to five words ending in "." or ":" with more text after it,
// or one to five words followed by a dash ("Complication - the alumni…").
class BoldListItems {
  // A word starts with a letter or digit in any language, and may contain
  // apostrophes and hyphens ("Don't", "e-mail", "Bogotá").
  static word = "[\\p{L}\\p{N}_][\\p{L}\\p{N}_'’-]*";
  static maxWords = 5;

  // "- ", "* ", "+ ", "1. " or "1) ", indented or not, and not already bold.
  static marker = /^(\s*(?:[-*+]|\d+[.)])\s+)(?!\*\*|__)/;

  // Tried in order; the first that matches is the label.
  static labels = (() => {
    const words = `${BoldListItems.word}(?: ${BoldListItems.word}){0,${BoldListItems.maxWords - 1}}`;
    return [
      new RegExp(`^${words}[.:](?=\\s+\\S)`, "u"), // "Evernote. They do…"
      new RegExp(`^${words}:$`, "u"), // "Goals:" heading a sub-list
      new RegExp(`^${words}(?=\\s+[-–—]\\s)`, "u"), // "Complication - the alumni…"
    ];
  })();

  // Bolds the label of every list item in text, leaving fenced code alone.
  static text(text) {
    let inCode = false;
    return text
      .split("\n")
      .map((line) => {
        if (/^\s*(```|~~~)/.test(line)) inCode = !inCode;
        return inCode ? line : BoldListItems.line(line);
      })
      .join("\n");
  }

  // One line with its label bolded, or unchanged when it has none.
  static line(line) {
    const marker = line.match(BoldListItems.marker)?.[1];
    if (marker == null) return line;

    const rest = line.slice(marker.length);
    const label = BoldListItems.labels.map((pattern) => rest.match(pattern)?.[0]).find(Boolean);
    if (!label) return line;

    return `${marker}**${label}**${rest.slice(label.length)}`;
  }
}
