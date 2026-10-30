// Builds the @tags and lines Things Parser reads, for actions that type them
// into a draft. See ThingsParser for what each one does.
class ThingsTags {
  // The line break and indent that start a note under line: one tab deeper
  // under a to-do ("- ...") or project ("...:", tags allowed after the
  // colon), level with another note.
  static noteBreak(line) {
    const indent = line.match(/^\s*/)[0];
    const withoutTags = line.replace(/(\s+@[^\s(]+(\([^)]*\))?)+\s*$/, "").trimEnd();
    const isItem = /^\s*[-*+] /.test(line) || withoutTags.endsWith(":");
    return `\n${indent}${isItem ? "\t" : ""}`;
  }

  static area(name) {
    return `@area(${name})`;
  }

  // "@project(title)", or "@listID(id)" when another open project has the
  // same title, so the to-do still lands in the one picked.
  static project({ title, id }, projects = []) {
    const sharedTitle = projects.filter((other) => other.title == title).length > 1;
    return sharedTitle ? `@listID(${id})` : `@project(${title})`;
  }

  // The day only, e.g. "@when(2026-10-28)". With a reminder, the picked time
  // goes after the day, e.g. "@when(2026-10-28@14:15)", which Things turns
  // into a reminder at that time.
  static when(date, reminder = false) {
    const day = strftime(date, "%Y-%m-%d");
    return reminder ? `@when(${day}@${strftime(date, "%H:%M")})` : `@when(${day})`;
  }
}
