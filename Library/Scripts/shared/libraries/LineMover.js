// Moves the lines under the cursor or selection up or down by one line, the
// way code editors do. The selection moves with the text unchanged, so
// pressing the action again moves the same lines again.
//
// Replaces a script found online that grew the selection by a line on some
// presses. That script treated a selection ending just after a line break as
// also selecting the next line, and broke on a selection ending at the end of
// the draft.
class LineMover {
  // Moves the lines selected in the editor. Does nothing when they are already
  // at the top (up) or bottom (down) of the draft.
  static moveInEditor(editor, direction) {
    const edit = LineMover.move(editor.getText(), editor.getSelectedRange(), direction);
    if (!edit) return;

    editor.setTextInRange(edit.location, edit.length, edit.replacement);
    editor.setSelectedRange(...edit.selection);
  }

  // Works out the edit for moving the selected lines of text one line up or
  // down. Returns the range to replace, its replacement (always the same
  // length), and the new selection, or null when there is nowhere to move.
  // selection is [start, length], as editor.getSelectedRange() returns it.
  static move(text, [start, length], direction) {
    const lines = text.split("\n");
    const lineCount = LineMover.countLines(text, lines);
    const first = LineMover.lineIndex(text, start);
    const last = LineMover.lineIndex(text, LineMover.lastSelectedPosition(text, start, length));
    const passed = direction == "up" ? first - 1 : last + 1;
    if (last >= lineCount || passed < 0 || passed >= lineCount) return null;

    // The edit covers the selected lines plus the one they swap with.
    const top = Math.min(first, passed);
    const bottom = Math.max(last, passed);
    const block = lines.slice(first, last + 1);
    const reordered = direction == "up" ? [...block, lines[passed]] : [lines[passed], ...block];

    // The selection shifts by the passed line and its line break.
    const shift = (lines[passed].length + 1) * (direction == "up" ? -1 : 1);
    const location = LineMover.lineStart(lines, top);
    const replacement = reordered.join("\n");
    return { location, length: replacement.length, replacement, selection: [start + shift, length] };
  }

  // A line break at the very end closes the last line rather than starting
  // an empty one, so it doesn't count as a line to move or swap with.
  static countLines(text, lines) {
    return text.endsWith("\n") ? lines.length - 1 : lines.length;
  }

  // Which line (from 0) a position in the text falls on.
  static lineIndex(text, position) {
    return text.slice(0, position).split("\n").length - 1;
  }

  // Where the selection's last line is. A selection that ends just after a
  // line break stops at the start of the next line, so that line isn't moved.
  static lastSelectedPosition(text, start, length) {
    const end = start + length;
    const endsAfterLineBreak = length > 0 && text[end - 1] == "\n";
    return endsAfterLineBreak ? end - 1 : end;
  }

  // The position where a line (from 0) starts.
  static lineStart(lines, index) {
    return lines.slice(0, index).reduce((position, line) => position + line.length + 1, 0);
  }
}
