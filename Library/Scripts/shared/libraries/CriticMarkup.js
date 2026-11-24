// Toggles CriticMarkup marks in the editor: highlights ({== text ==}),
// comments ({>> text <<}), additions ({++ text ++}), deletions ({-- text --})
// and substitutions ({~~ old ~> new ~~}).
//
// Pressing outside a mark wraps the selection in it. Pressing inside one
// resolves it: highlights and comments lose their delimiters, additions are
// accepted (the text stays), deletions are accepted (the text goes), and
// substitutions are accepted (the new text replaces the old, selected).
//
// Marks are written with a space inside each delimiter for readability. Marks
// written without the spaces, as the CriticMarkup spec shows them, are
// recognized too.
//
// Replaces a highlight script found online that could only add highlights.
class CriticMarkup {
  // label: the button name in the CriticMarkup menu.
  // middle: the delimiter between old and new text, for substitutions.
  // insertEmpty: with only a cursor outside the mark, insert an empty one to
  // type into, rather than doing nothing.
  // leaves: what pressing inside the mark leaves behind: its "text" without
  // the delimiters, "nothing", or its "newText" (after the middle delimiter).
  static marks = {
    highlight: { label: "Highlight", open: "{==", close: "==}", insertEmpty: false, leaves: "text" },
    comment: { label: "Comment", open: "{>>", close: "<<}", insertEmpty: true, leaves: "text" },
    addition: { label: "Addition", open: "{++", close: "++}", insertEmpty: true, leaves: "text" },
    deletion: { label: "Deletion", open: "{--", close: "--}", insertEmpty: false, leaves: "nothing" },
    substitution: { label: "Substitution", open: "{~~", middle: "~>", close: "~~}", insertEmpty: false, leaves: "newText" },
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
    if (found) return CriticMarkup.resolve(text, found, selection, mark);
    if (selection[1] > 0 || mark.insertEmpty) return CriticMarkup.wrap(text, selection, mark);
    return null;
  }

  // The buttons for the CriticMarkup menu, one per mark, as buildMenu takes them.
  static menuItems() {
    return Object.entries(CriticMarkup.marks).map(([value, { label }]) => ({ type: "button", data: { name: label, value } }));
  }

  // The name of the smallest mark of any kind holding the cursor or
  // selection, or null when it is outside every mark.
  static innermostMarkName(text, selection) {
    const around = Object.entries(CriticMarkup.marks)
      .map(([name, mark]) => ({ name, found: CriticMarkup.markAround(text, selection, mark) }))
      .filter(({ found }) => found)
      .sort((a, b) => a.found.length - b.found.length);
    return around.length ? around[0].name : null;
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
    const escape = (delimiter) => delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(${escape(open)} ?)((?:(?!${escape(open)})[\\s\\S])*?) ?${escape(close)}`, "g");
  }

  // Replaces a mark with what pressing inside it leaves behind.
  static resolve(text, found, selection, mark) {
    if (mark.leaves == "nothing") return CriticMarkup.remove(text, found);
    if (mark.leaves == "newText") return CriticMarkup.acceptNewText(text, found, mark);
    if (found.inner == "") return CriticMarkup.remove(text, found);
    return CriticMarkup.unwrap(found, selection);
  }

  // Removes a mark's delimiters and padding. A selection edge sitting on a
  // delimiter moves to the nearest edge of the text inside it.
  static unwrap({ location, length, textStart, inner }, [start, selectedLength]) {
    const keepInside = (position) => location + Math.min(Math.max(position - textStart, 0), inner.length);
    const newStart = keepInside(start);
    const newEnd = keepInside(start + selectedLength);
    return { location, length, replacement: inner, selection: [newStart, newEnd - newStart] };
  }

  // Replaces a substitution with its new text and selects it. With no new
  // text written, the old text is just deleted.
  static acceptNewText(text, found, { middle }) {
    const at = found.inner.indexOf(middle);
    const newText = at < 0 ? found.inner : found.inner.slice(at + middle.length).replace(/^ /, "");
    if (newText == "") return CriticMarkup.remove(text, found);

    const { location, length } = found;
    return { location, length, replacement: newText, selection: [location, newText.length] };
  }

  // Removes a whole mark, text and all, and leaves the cursor where it was.
  // Also removes one space after the mark, so the words around it don't end
  // up with two spaces between them. The space before it always stays.
  static remove(text, { location, length }) {
    const end = location + length;
    const removed = text[end] == " " ? length + 1 : length;
    return { location, length: removed, replacement: "", selection: [location, 0] };
  }

  // Wraps the selection in a mark's delimiters. Keeps the same text selected,
  // except in a substitution, where the cursor goes where the new text is
  // typed: {~~ old ~> | ~~}.
  static wrap(text, [start, length], { open, middle, close }) {
    const selected = text.substr(start, length);
    if (middle) {
      const beforeCursor = `${open} ${selected} ${middle} `;
      return { location: start, length, replacement: `${beforeCursor} ${close}`, selection: [start + beforeCursor.length, 0] };
    }

    const opening = `${open} `;
    return { location: start, length, replacement: `${opening}${selected} ${close}`, selection: [start + opening.length, length] };
  }
}
