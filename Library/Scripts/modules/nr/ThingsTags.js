// Builds the @tags Things Parser reads, for actions that type them into a
// draft. See ThingsParser for what each tag does.
class ThingsTags {
  static area(name) {
    return `@area(${name})`;
  }

  // The day only, e.g. "@when(2026-10-28)". With a reminder, the picked time
  // goes after the day, e.g. "@when(2026-10-28@14:15)", which Things turns
  // into a reminder at that time.
  static when(date, reminder = false) {
    const day = strftime(date, "%Y-%m-%d");
    return reminder ? `@when(${day}@${strftime(date, "%H:%M")})` : `@when(${day})`;
  }
}
