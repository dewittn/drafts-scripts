// Rebuilds the table in a season record draft, held as an array of lines.
// Everything up to and including the table's separator row (|:--|:--|...) is
// kept; every line after it is replaced by the rows given. Pure: no Drafts
// objects, and the lines passed in are never changed.
class SeasonRecordTable {
  // A Markdown table separator row: |:--|:--| (colons and spaces optional).
  static separatorPattern = /^\|(\s*:?-+:?\s*\|)+$/;

  // Index of the table's separator row, or -1 when the draft has no table.
  static separatorIndex(lines) {
    return lines.findIndex((line) => SeasonRecordTable.separatorPattern.test(line.trim()));
  }

  // The non-blank lines after the separator: the rows the draft has now.
  static existingRows(lines) {
    const separator = SeasonRecordTable.separatorIndex(lines);
    if (separator == -1) return [];
    return lines.slice(separator + 1).filter((line) => line.trim() != "");
  }

  // The draft's lines with its rows replaced by rows, and the existing rows
  // that would disappear. expectedGone lists rows that are meant to go (the
  // edited game's old row); each is left out of `vanished` once. A trailing
  // blank line is kept. Undefined when the draft has no table.
  static rebuild(lines, rows, expectedGone = []) {
    const separator = SeasonRecordTable.separatorIndex(lines);
    if (separator == -1) return undefined;

    const trailing = lines.length > separator + 1 && lines[lines.length - 1] == "" ? [""] : [];
    const updated = [...lines.slice(0, separator + 1), ...rows, ...trailing];
    const vanished = SeasonRecordTable.#missingFrom(SeasonRecordTable.existingRows(lines), rows);
    return { lines: updated, vanished: SeasonRecordTable.#missingFrom(vanished, expectedGone) };
  }

  // The lines of `from` not found in `among`, matching each line of `among`
  // at most once (so two identical rows need two matches). Compared trimmed.
  static #missingFrom(from, among) {
    const unmatched = among.map((line) => line.trim());
    return from.filter((line) => {
      const index = unmatched.indexOf(line.trim());
      if (index == -1) return true;
      unmatched.splice(index, 1);
      return false;
    });
  }
}
