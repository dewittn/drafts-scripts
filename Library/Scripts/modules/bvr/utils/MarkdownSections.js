// Edits a Markdown draft held as an array of lines: its "# " title line and
// the bodies of its "## " sections. A section's body is every line after its
// heading up to the next "## " heading (or the end). Pure: no Drafts objects,
// and the lines passed in are never changed.
class MarkdownSections {
  // Index of the first "# " title line, or -1.
  static titleIndex(lines) {
    return lines.findIndex((line) => line.startsWith("# "));
  }

  // Index of a "## " heading (trailing spaces ignored), or -1.
  static headingIndex(lines, heading) {
    return lines.findIndex((line) => line.trimEnd() == heading);
  }

  // The lines between a heading and the next "## " heading, or undefined
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

  // Index just past a section's body: the next "## " heading, or the end.
  static #bodyEnd(lines, headingIndex) {
    const next = lines.findIndex((line, i) => i > headingIndex && line.startsWith("## "));
    return next == -1 ? lines.length : next;
  }
}
