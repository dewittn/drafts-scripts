// Toggles Markdown bold (**text**) and italics (_text_) in the editor, the
// same way CriticMarkup toggles its marks.
//
// Pressing outside the style wraps the selection in it, or inserts an empty
// pair to type into when there is only a cursor. Pressing inside it removes
// the style and selects the text: with the cursor anywhere in a bolded word,
// Bold takes the ** off and selects the word.
// Bold and italics nest, so _**text**_ loses only the style that was pressed.
//
// Italics are written with underscores so they look different from bold.
// Emphasis written either way is recognized when removing it: *italic*,
// __bold__ and ***both*** toggle off too. Emphasis is looked for within one
// line.
//
// Replaces the Drafts example Bold and Italic actions, which could only add.
class MarkdownEmphasis {
  // What each style writes on either side of its text.
  static delimiters = { bold: "**", italic: "_" };

  // A run of one to three asterisks or underscores, text that doesn't start
  // or end with a space or the same character, and the same run again:
  // *italic*, **bold**, ***both***. Underscores only count outside a word,
  // as in CommonMark, so snake_case_names aren't italics.
  static patterns = [
    /(?<!\*)(\*{1,3})(?![\s*])(.+?)(?<![\s*])\1(?!\*)/g,
    /(?<!\w)(_{1,3})(?![\s_])(.+?)(?<![\s_])\1(?!\w)/g,
  ];

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
    if (found) return MarkdownEmphasis.unwrap(found, style);
    if (MarkdownEmphasis.inEmptyPair(text, selection, style)) return MarkdownEmphasis.removeEmptyPair(selection, style);
    return MarkdownEmphasis.wrap(text, selection, style);
  }

  // The innermost emphasis with this style that holds the whole cursor or
  // selection, as { location, length, run, textStart, inner }, or null.
  // Looks inside emphasis of the other style, so _italic_ inside **bold** is
  // found. offset is where text starts in the draft, for those inner looks.
  static emphasisAround(text, [start, length], style, offset = 0) {
    const matches = MarkdownEmphasis.patterns.flatMap((pattern) => [...text.matchAll(pattern)]);
    for (const match of matches) {
      const location = offset + match.index;
      const [whole, run, inner] = match;
      if (start < location || location + whole.length < start + length) continue;

      const textStart = location + run.length;
      const nested = MarkdownEmphasis.emphasisAround(inner, [start, length], style, textStart);
      if (nested) return nested;
      if (MarkdownEmphasis.runHas(run.length, style)) return { location, length: whole.length, run, textStart, inner };
    }
    return null;
  }

  // Whether a run of asterisks or underscores includes a style: one is
  // italic, two bold, three both.
  static runHas(runLength, style) {
    return style == "bold" ? runLength >= 2 : runLength % 2 == 1;
  }

  // Takes a style off an emphasis, leaving the other style when it had both,
  // in the same character it was written in. Selects the text that was
  // inside, so it is easy to restyle or replace.
  static unwrap({ location, length, run, inner }, style) {
    const left = run[0].repeat(run.length - MarkdownEmphasis.width(style));
    return { location, length, replacement: `${left}${inner}${left}`, selection: [location + left.length, inner.length] };
  }

  // How many characters a style puts on either side: one for italics, two
  // for bold, whichever character they are written in.
  static width(style) {
    return MarkdownEmphasis.delimiters[style].length;
  }

  // Whether the cursor sits between the delimiters of a pair inserted empty,
  // such as **|** for bold or _|_ for italics.
  static inEmptyPair(text, [start, length], style) {
    const delimiter = MarkdownEmphasis.delimiters[style];
    const char = delimiter[0];
    const before = text.slice(0, start);
    const after = text.slice(start);
    return (
      length == 0 &&
      before.endsWith(delimiter) &&
      after.startsWith(delimiter) &&
      !before.endsWith(`${char}${delimiter}`) &&
      !after.startsWith(`${delimiter}${char}`)
    );
  }

  // Removes an empty pair around the cursor.
  static removeEmptyPair([start], style) {
    const width = MarkdownEmphasis.width(style);
    return { location: start - width, length: width * 2, replacement: "", selection: [start - width, 0] };
  }

  // Wraps the selection in a style's delimiters and keeps it selected. Spaces
  // at either end of the selection stay outside, since "** text **" isn't
  // bold. With only a cursor, inserts an empty pair with the cursor inside.
  static wrap(text, [start, length], style) {
    const selected = text.substr(start, length);
    const trimmed = selected.trim();
    const trimmedStart = trimmed ? start + selected.indexOf(trimmed) : start;
    const delimiter = MarkdownEmphasis.delimiters[style];
    return {
      location: trimmedStart,
      length: trimmed.length,
      replacement: `${delimiter}${trimmed}${delimiter}`,
      selection: [trimmedStart + delimiter.length, trimmed.length],
    };
  }
}
