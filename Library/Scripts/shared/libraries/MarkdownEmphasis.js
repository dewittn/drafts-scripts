// Toggles Markdown bold (**text**) and italics (*text*) in the editor, the
// same way CriticMarkup toggles its marks.
//
// Pressing outside the style wraps the selection in it, or inserts an empty
// pair to type into when there is only a cursor. Pressing inside it removes
// the style: with the cursor anywhere in a bolded word, Bold takes the ** off.
// Bold and italics nest, so ***text*** loses only the style that was pressed.
//
// Only asterisks are recognized, since that is what these actions write.
// Emphasis is looked for within one line.
//
// Replaces the Drafts example Bold and Italic actions, which could only add.
class MarkdownEmphasis {
  // How many asterisks each style puts on either side of its text.
  static stars = { bold: 2, italic: 1 };

  // A run of one to three asterisks, text that doesn't start or end with a
  // space or asterisk, and the same run again: *italic*, **bold**, ***both***.
  static pattern = /(?<!\*)(\*{1,3})(?![\s*])(.+?)(?<![\s*])\1(?!\*)/g;

  // Toggles a style at the editor's cursor or selection.
  static toggleInEditor(editor, style) {
    const edit = MarkdownEmphasis.toggle(editor.getText(), editor.getSelectedRange(), style);
    editor.setTextInRange(edit.location, edit.length, edit.replacement);
    editor.setSelectedRange(...edit.selection);
    editor.activate();
  }

  // Works out the edit for toggling a style. Returns the range to replace, its
  // replacement, and the new selection. selection is [start, length], as
  // editor.getSelectedRange() returns it.
  static toggle(text, selection, style) {
    const found = MarkdownEmphasis.emphasisAround(text, selection, style);
    if (found) return MarkdownEmphasis.unwrap(found, selection, style);
    if (MarkdownEmphasis.inEmptyPair(text, selection, style)) return MarkdownEmphasis.removeEmptyPair(selection, style);
    return MarkdownEmphasis.wrap(text, selection, style);
  }

  // The innermost emphasis with this style that holds the whole cursor or
  // selection, as { location, length, run, textStart, inner }, or null.
  // Looks inside emphasis of the other style, so *italic* inside **bold** is
  // found. offset is where text starts in the draft, for those inner looks.
  static emphasisAround(text, [start, length], style, offset = 0) {
    for (const match of text.matchAll(MarkdownEmphasis.pattern)) {
      const location = offset + match.index;
      const [whole, run, inner] = match;
      if (start < location || location + whole.length < start + length) continue;

      const textStart = location + run.length;
      const nested = MarkdownEmphasis.emphasisAround(inner, [start, length], style, textStart);
      if (nested) return nested;
      if (MarkdownEmphasis.runHas(run.length, style)) return { location, length: whole.length, run: run.length, textStart, inner };
    }
    return null;
  }

  // Whether a run of asterisks includes a style: one is italic, two bold,
  // three both.
  static runHas(runLength, style) {
    return style == "bold" ? runLength >= 2 : runLength % 2 == 1;
  }

  // Takes a style's asterisks off an emphasis, leaving the other style when
  // it had both. A selection edge sitting on the asterisks moves to the
  // nearest edge of the text inside them.
  static unwrap({ location, length, run, textStart, inner }, [start, selectedLength], style) {
    const left = "*".repeat(run - MarkdownEmphasis.stars[style]);
    const keepInside = (position) => location + left.length + Math.min(Math.max(position - textStart, 0), inner.length);
    const newStart = keepInside(start);
    const newEnd = keepInside(start + selectedLength);
    return { location, length, replacement: `${left}${inner}${left}`, selection: [newStart, newEnd - newStart] };
  }

  // Whether the cursor sits between the asterisks of a pair inserted empty,
  // such as **|** for bold.
  static inEmptyPair(text, [start, length], style) {
    const delimiter = "*".repeat(MarkdownEmphasis.stars[style]);
    const before = text.slice(0, start);
    const after = text.slice(start);
    return (
      length == 0 &&
      before.endsWith(delimiter) &&
      after.startsWith(delimiter) &&
      !before.endsWith(`*${delimiter}`) &&
      !after.startsWith(`${delimiter}*`)
    );
  }

  // Removes an empty pair around the cursor.
  static removeEmptyPair([start], style) {
    const width = MarkdownEmphasis.stars[style];
    return { location: start - width, length: width * 2, replacement: "", selection: [start - width, 0] };
  }

  // Wraps the selection in a style's asterisks and keeps it selected. Spaces
  // at either end of the selection stay outside, since "** text **" isn't
  // bold. With only a cursor, inserts an empty pair with the cursor inside.
  static wrap(text, [start, length], style) {
    const selected = text.substr(start, length);
    const trimmed = selected.trim();
    const trimmedStart = trimmed ? start + selected.indexOf(trimmed) : start;
    const delimiter = "*".repeat(MarkdownEmphasis.stars[style]);
    return {
      location: trimmedStart,
      length: trimmed.length,
      replacement: `${delimiter}${trimmed}${delimiter}`,
      selection: [trimmedStart + delimiter.length, trimmed.length],
    };
  }
}
