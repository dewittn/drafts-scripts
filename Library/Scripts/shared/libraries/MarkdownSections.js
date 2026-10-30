// Edits a Markdown draft held as an array of lines: its "# " title line and
// the bodies of its sections. A section's body is every line after its
// heading up to the next heading of the same or a higher level (so a "### "
// section stops at "### " or "## "), or the end. Pure: no Drafts objects, and
// the lines passed in are never changed.
class MarkdownSections {
  // Index of the first "# " title line, or -1.
  static titleIndex(lines) {
    return lines.findIndex((line) => line.startsWith("# "));
  }

  // Index of a heading line such as "## Score" (trailing spaces ignored), or -1.
  static headingIndex(lines, heading) {
    return lines.findIndex((line) => line.trimEnd() == heading);
  }

  // The lines between a heading and the end of its section, or undefined
  // when the heading is missing.
  static body(lines, heading) {
    const start = MarkdownSections.headingIndex(lines, heading);
    if (start == -1) return undefined;
    return lines.slice(start + 1, MarkdownSections.#bodyEnd(lines, start));
  }

  // The lines with the title line swapped for title. Unchanged (a copy)
  // when there is no title line.
  static replaceTitle(lines, title) {
    const index = MarkdownSections.titleIndex(lines);
    const updated = [...lines];
    if (index != -1) updated[index] = title;
    return updated;
  }

  // The lines with one section's body swapped for bodyLines. Unchanged (a
  // copy) when the heading is missing.
  static replaceBody(lines, heading, bodyLines) {
    const start = MarkdownSections.headingIndex(lines, heading);
    if (start == -1) return [...lines];
    const end = MarkdownSections.#bodyEnd(lines, start);
    return [...lines.slice(0, start + 1), ...bodyLines, ...lines.slice(end)];
  }

  // The lines without a section: its heading and its body. Unchanged (a
  // copy) when the heading is missing.
  static removeSection(lines, heading) {
    const start = MarkdownSections.headingIndex(lines, heading);
    if (start == -1) return [...lines];
    return [...lines.slice(0, start), ...lines.slice(MarkdownSections.#bodyEnd(lines, start))];
  }

  // Copy the title line and the named sections' bodies from source (for
  // example a freshly rendered template) into target, leaving every other
  // line of target as it was. Headings missing from either side are skipped
  // and listed in `missing`; "title" stands for a missing title line.
  static transplant(target, source, headings) {
    const missing = [];
    let lines = [...target];

    const sourceTitle = source[MarkdownSections.titleIndex(source)];
    if (sourceTitle == undefined || MarkdownSections.titleIndex(lines) == -1) {
      missing.push("title");
    } else {
      lines = MarkdownSections.replaceTitle(lines, sourceTitle);
    }

    for (const heading of headings) {
      const sourceBody = MarkdownSections.body(source, heading);
      if (sourceBody == undefined || MarkdownSections.headingIndex(lines, heading) == -1) {
        missing.push(heading);
        continue;
      }
      lines = MarkdownSections.replaceBody(lines, heading, sourceBody);
    }
    return { lines, missing };
  }

  // Index just past a section's body: the next heading of the same or a
  // higher level, or the end.
  static #bodyEnd(lines, headingIndex) {
    const level = MarkdownSections.#level(lines[headingIndex]);
    const next = lines.findIndex((line, i) => {
      const lineLevel = MarkdownSections.#level(line);
      return i > headingIndex && lineLevel > 0 && lineLevel <= level;
    });
    return next == -1 ? lines.length : next;
  }

  // 2 for "## Score", 0 for a line that is not a heading.
  static #level(line) {
    return line.match(/^(#{1,6}) /)?.[1].length ?? 0;
  }
}
