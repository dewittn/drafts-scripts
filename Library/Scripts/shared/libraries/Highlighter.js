// Toggles CriticMarkup highlights ({==text==}) in the editor. With the cursor
// or selection inside a highlight, removes that highlight's markers. Otherwise
// wraps the selection in them. The same text stays selected either way, so
// pressing the action again undoes it.
//
// Replaces a script found online that could only add highlights.
class Highlighter {
  static open = "{==";
  static close = "==}";

  // A highlight is the shortest run from {== to ==} that contains no other {==,
  // so an unclosed {== earlier in the draft can't swallow a later highlight.
  static pattern = /\{==((?:(?!\{==)[\s\S])*?)==\}/g;

  // Toggles the highlight at the editor's cursor or selection. Does nothing
  // when the cursor is outside any highlight and nothing is selected.
  static toggleInEditor(editor) {
    const edit = Highlighter.toggle(editor.getText(), editor.getSelectedRange());
    if (!edit) return;

    editor.setTextInRange(edit.location, edit.length, edit.replacement);
    editor.setSelectedRange(...edit.selection);
    editor.activate();
  }

  // Works out the edit for toggling a highlight. Returns the range to replace,
  // its replacement, and the new selection, or null when there is nothing to do.
  // selection is [start, length], as editor.getSelectedRange() returns it.
  static toggle(text, selection) {
    const highlight = Highlighter.highlightAround(text, selection);
    if (highlight) return Highlighter.unwrap(highlight, selection);
    if (selection[1] > 0) return Highlighter.wrap(text, selection);
    return null;
  }

  // The highlight that holds the whole cursor or selection, markers included,
  // as { location, length, inner }, or null when there isn't one.
  static highlightAround(text, [start, length]) {
    for (const match of text.matchAll(Highlighter.pattern)) {
      const end = match.index + match[0].length;
      if (match.index <= start && start + length <= end) {
        return { location: match.index, length: match[0].length, inner: match[1] };
      }
    }
    return null;
  }

  // Removes a highlight's markers. A selection edge sitting on a marker moves
  // to the nearest edge of the text inside it.
  static unwrap({ location, length, inner }, [start, selectedLength]) {
    const textStart = location + Highlighter.open.length;
    const keepInside = (position) => location + Math.min(Math.max(position - textStart, 0), inner.length);
    const newStart = keepInside(start);
    const newEnd = keepInside(start + selectedLength);
    return { location, length, replacement: inner, selection: [newStart, newEnd - newStart] };
  }

  // Wraps the selection in highlight markers and keeps the same text selected.
  static wrap(text, [start, length]) {
    const replacement = Highlighter.open + text.substr(start, length) + Highlighter.close;
    return { location: start, length, replacement, selection: [start + Highlighter.open.length, length] };
  }
}
