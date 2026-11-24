// Selects the text around the cursor, a bit like Vim's "select around"
// (`vas`). In a paragraph it selects the sentence the cursor is in. On a list
// item or heading it selects the whole line.
//
// A sentence ends at ".", "!", "?" or "…" followed by a space or the end of
// the line, with any closing quotes, brackets or emphasis after the mark kept
// in the sentence. The spaces after a sentence belong to it, so a cursor
// between two sentences selects the one before. Those spaces are never
// selected themselves.
class SelectAround {
  // "- ", "* ", "+ ", "1. ", "1) " or "# ", indented or not.
  static wholeLine = /^\s*(?:[-*+]|\d+[.)]|#+)\s/;

  // Indentation and blockquote markers ("> ") before a paragraph's text.
  static prefix = /^\s*(?:>\s*)*/;

  // A sentence's end mark, what may close around it, and the spaces after it.
  static sentenceEnd = /[.!?…]+["'”’)\]*_]*(\s+|$)/g;

  // Selects the sentence or line around the editor's cursor. Does nothing on
  // a blank line.
  static selectInEditor(editor) {
    const selection = SelectAround.around(editor.getText(), editor.getSelectedRange());
    if (!selection) return;

    editor.setSelectedRange(...selection);
    editor.activate();
  }

  /**
   * Works out what to select around the start of the cursor or selection.
   * @param {string} text the whole draft
   * @param {[number, number]} selection [start, length], as editor.getSelectedRange() returns it
   * @returns {[number, number] | null} the new selection, or null on a blank line
   */
  static around(text, [start]) {
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = text.indexOf("\n", start);
    const line = text.slice(lineStart, lineEnd < 0 ? text.length : lineEnd);
    if (line.trim() == "") return null;

    if (SelectAround.wholeLine.test(line)) return [lineStart, line.length];

    const sentence = SelectAround.sentenceAt(line, start - lineStart);
    return [lineStart + sentence.start, sentence.end - sentence.start];
  }

  // The sentence holding a position in a line, as { start, end } within the
  // line. A position past the last sentence's spaces gets the last sentence.
  static sentenceAt(line, position) {
    const sentences = SelectAround.sentences(line);
    return sentences.find(({ next }) => position < next) || sentences[sentences.length - 1];
  }

  // Splits a line into sentences. Each has where its text starts and ends,
  // and where the next one starts (after its spaces).
  static sentences(line) {
    const sentences = [];
    let start = line.match(SelectAround.prefix)[0].length;

    for (const match of line.matchAll(SelectAround.sentenceEnd)) {
      const next = match.index + match[0].length;
      if (next <= start) continue;
      sentences.push({ start, end: next - match[1].length, next });
      start = next;
    }
    if (start < line.length) sentences.push({ start, end: line.trimEnd().length, next: line.length });
    return sentences;
  }
}
