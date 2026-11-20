// Toggles CriticMarkup marks in the editor: highlights ({== text ==}),
// comments ({>> text <<}) and deletions ({-- text --}). With the cursor or
// selection inside the mark, removes its delimiters, keeping the same text
// selected so pressing again undoes it. Inside a deletion it removes the
// whole mark, text and all, which accepts the deletion. Otherwise wraps the
// selection in the mark.
//
// Marks are written with a space inside each delimiter for readability. Marks
// written without the spaces, as the CriticMarkup spec shows them, are
// recognized too.
//
// Replaces a highlight script found online that could only add highlights.
class CriticMarkup {
  // insertEmpty: with only a cursor outside a mark, insert an empty one to
  // type into, rather than doing nothing.
  // keepText: pressing inside the mark removes only its delimiters. When
  // false, it removes the text inside too.
  static marks = {
    highlight: { open: "{==", close: "==}", insertEmpty: false, keepText: true },
    comment: { open: "{>>", close: "<<}", insertEmpty: true, keepText: true },
    deletion: { open: "{--", close: "--}", insertEmpty: false, keepText: false },
  };

  // Toggles a mark at the editor's cursor or selection.
  static toggleInEditor(editor, markName) {
    const edit = CriticMarkup.toggle(editor.getText(), editor.getSelectedRange(), markName);
    if (!edit) return;

    editor.setTextInRange(edit.location, edit.length, edit.replacement);
    editor.setSelectedRange(...edit.selection);
    editor.activate();
  }

  // Works out the edit for toggling a mark. Returns the range to replace, its
  // replacement, and the new selection, or null when there is nothing to do.
  // selection is [start, length], as editor.getSelectedRange() returns it.
  static toggle(text, selection, markName) {
    const mark = CriticMarkup.marks[markName];
    const found = CriticMarkup.markAround(text, selection, mark);
    if (found) return mark.keepText ? CriticMarkup.unwrap(found, selection) : CriticMarkup.remove(text, found);
    if (selection[1] > 0 || mark.insertEmpty) return CriticMarkup.wrap(text, selection, mark);
    return null;
  }

  // The mark that holds the whole cursor or selection, delimiters included, as
  // { location, length, textStart, inner }, or null when there isn't one.
  static markAround(text, [start, length], mark) {
    for (const match of text.matchAll(CriticMarkup.pattern(mark))) {
      const end = match.index + match[0].length;
      if (match.index <= start && start + length <= end) {
        const [whole, opening, inner] = match;
        return { location: match.index, length: whole.length, textStart: match.index + opening.length, inner };
      }
    }
    return null;
  }

  // A mark runs from its opening to its closing delimiter, each with an
  // optional padding space, and holds no other opening delimiter, so an
  // unclosed one earlier in the draft can't swallow a later mark.
  static pattern({ open, close }) {
    const escape = (delimiter) => delimiter.replace(/[{}]/g, "\\$&");
    return new RegExp(`(${escape(open)} ?)((?:(?!${escape(open)})[\\s\\S])*?) ?${escape(close)}`, "g");
  }

  // Removes a mark's delimiters and padding. A selection edge sitting on a
  // delimiter moves to the nearest edge of the text inside it.
  static unwrap({ location, length, textStart, inner }, [start, selectedLength]) {
    const keepInside = (position) => location + Math.min(Math.max(position - textStart, 0), inner.length);
    const newStart = keepInside(start);
    const newEnd = keepInside(start + selectedLength);
    return { location, length, replacement: inner, selection: [newStart, newEnd - newStart] };
  }

  // Removes a whole mark, text and all, and leaves the cursor where it was.
  // Also removes one space beside it, so the words around it don't end up
  // with two spaces between them or a space before punctuation.
  static remove(text, { location, length }) {
    let start = location;
    let end = location + length;
    const before = text[start - 1];
    const after = text[end];
    const lineEdge = (char) => char === undefined || char == "\n";

    if (after == " " && (before == " " || lineEdge(before))) end++;
    else if (before == " " && (lineEdge(after) || /[.,;:!?)]/.test(after))) start--;
    return { location: start, length: end - start, replacement: "", selection: [start, 0] };
  }

  // Wraps the selection in a mark's delimiters and keeps the same text selected.
  static wrap(text, [start, length], { open, close }) {
    const opening = `${open} `;
    const replacement = opening + text.substr(start, length) + ` ${close}`;
    return { location: start, length, replacement, selection: [start + opening.length, length] };
  }
}
