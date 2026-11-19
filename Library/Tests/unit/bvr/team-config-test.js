/**
 * TeamConfig and Staff Unit Tests
 *
 * Covers merging level defaults with a team's teams.yaml overrides, turning
 * initials into contacts, form lookup, and the derived tags and template
 * files. All people and contacts are synthetic.
 */

require("../Tests/fixtures/assertions.js");
require("modules/bvr/utils/Staff.js");
require("modules/bvr/utils/TeamConfig.js");
require("modules/bvr/utils/TmplSettings.js");
require("modules/bvr/utils/BVRUtilities.js");

const test = new TestAssertions("TeamConfig and Staff");

const staff = new Staff({
  AA: { name: "Alex Able", cell: "555-0101", email: "alex@example.com" },
  BB: { cell: "555-0102", email: "bea@example.com", coachName: "Coach Bea" },
  CC: { cell: "555-0103" },
  ATT: { email: "attendance@example.com" },
});

const level = {
  attendance: {
    absences: { type: "text", recipients: ["AA", "BB"], bodyText: "Absent from [[team_name]]: " },
    noAbsences: { type: "text", recipients: ["AA", "BB"], bodyText: "No one is absent." },
  },
  gameReport: {
    messages: [{ type: "text", recipients: ["AA"], bodyText: "[[game_summary]]" }],
    forms: ["short-form"],
  },
};

const forms = {
  "short-form": { title: "Short form", postData: true, fields: [{ key: "teamName", entryID: 1 }] },
  "long-form": { title: "Long form", postData: false, fields: [{ key: "opponent", entryID: 2 }] },
};

const baseTeam = {
  id: "test-hoops",
  level: "ms",
  defaultTag: "bvr/hoops/ms",
  practicePlan: { draftTags: ["bvr/hoops/practice/plan"] },
};

const config = (team, templateExists = () => false) =>
  new TeamConfig({ team: { ...baseTeam, ...team }, level, forms, staff, attendanceOffice: "ATT", templateExists });

// --- merge ---
test.section("merge");

test.assertDeepEqual(
  TeamConfig.merge({ a: { b: 1, c: 2 }, list: [1, 2] }, { a: { c: 3 }, list: [9] }),
  { a: { b: 1, c: 3 }, list: [9] },
  "objects merge key by key; lists replace",
);
test.assertDeepEqual(TeamConfig.merge({ a: 1 }, undefined), { a: 1 }, "no override keeps the base");

// --- level defaults only ---
test.section("level defaults");

let team = config({}, (file) => file == "bvr/test-hoops-game-day-project.mustache");
test.assertDeepEqual(
  team.attendanceSettings.absencesMsgConfig,
  { type: "text", recipients: ["555-0101", "555-0102"], bodyText: "Absent from [[team_name]]: " },
  "text recipients become cell numbers",
);
test.assertDeepEqual(team.gameReportSettings.messageSettings[0].recipients, ["555-0101"], "game report texts resolve too");
test.assertDeepEqual(team.formNames, ["short-form"], "forms come from the level");
test.assertDeepEqual(
  team.gameReportSettings.googleFormSettings,
  [{ name: "short-form", title: "Short form", postData: true, fields: [{ key: "teamName", entryID: 1 }] }],
  "form settings carry the name and field map, no URL",
);

let tmpl = team.templateSettings;
test.assertDeepEqual(tmpl.gameReport, { templateFile: "bvr/game-report.md", draftTags: ["bvr/hoops/ms/game/recap"] }, "recap tag derives from defaultTag");
test.assertEqual(tmpl.recordRow.templateFile, "bvr/game-record-row.md", "record row template default");
test.assertEqual(tmpl.seasonRecord.templateFile, "bvr/game-season-record.md", "season record template default");
test.assertDeepEqual(tmpl.practicePlan, { draftTags: ["bvr/hoops/practice/plan"] }, "practice plan tags from teams.yaml");
test.assertDeepEqual(tmpl.thingsProject, { templateFile: "bvr/test-hoops-game-day-project.mustache" }, "game-day project when the file exists");
test.assertEqual(tmpl.welcomeLetter, undefined, "no welcome letter unless the level or teams.yaml names one");
test.assertEqual(config({}).templateSettings.thingsProject, undefined, "no game-day project when the file is missing");
test.assertDeepEqual(tmpl.teamTemplateTags, { attendance_email: "attendance@example.com" }, "attendance_email from the attendance office");

tmpl.practicePlan.draftTags.unshift("bvr/hoops/ms");
test.assertDeepEqual(team.templateSettings.practicePlan.draftTags, ["bvr/hoops/practice/plan"], "callers get fresh copies");

// --- team overrides ---
test.section("team overrides");

team = config({
  forms: ["short-form", "long-form"],
  attendance: { absences: { recipients: ["CC"] } },
  gameReport: { messages: [{ type: "text", recipients: ["BB", "CC"], bodyText: "Score: [[game_score]]" }] },
  recapTag: "bvr/hoops/girls/game/recap",
  assistantCoaches: ["AA"],
  templateTags: { hc_year: "2nd" },
  templates: { welcomeLetter: "bvr/welcome-letter.md", thingsProject: "bvr/custom.mustache" },
});
test.assertDeepEqual(
  team.attendanceSettings.absencesMsgConfig,
  { type: "text", recipients: ["555-0103"], bodyText: "Absent from [[team_name]]: " },
  "overriding recipients keeps the level's other keys",
);
test.assertDeepEqual(team.attendanceSettings.noAbsencesMsgConfig.recipients, ["555-0101", "555-0102"], "untouched messages keep level recipients");
test.assertDeepEqual(
  team.gameReportSettings.messageSettings,
  [{ type: "text", recipients: ["555-0102", "555-0103"], bodyText: "Score: [[game_score]]" }],
  "a message list in teams.yaml replaces the level's",
);
test.assertDeepEqual(team.formNames, ["short-form", "long-form"], "forms override");
tmpl = team.templateSettings;
test.assertDeepEqual(tmpl.gameReport.draftTags, ["bvr/hoops/girls/game/recap"], "recapTag override");
test.assertDeepEqual(tmpl.welcomeLetter, { templateFile: "bvr/welcome-letter.md" }, "welcome letter override");

const levelLetter = (team) =>
  new TeamConfig({ team: { ...baseTeam, ...team }, level: { ...level, templates: { welcomeLetter: "bvr/ms-letter.mustache" } }, forms, staff });
test.assertDeepEqual(levelLetter({}).templateSettings.welcomeLetter, { templateFile: "bvr/ms-letter.mustache" }, "welcome letter from the level");
test.assertDeepEqual(
  levelLetter({ templates: { welcomeLetter: "bvr/own.mustache" } }).templateSettings.welcomeLetter,
  { templateFile: "bvr/own.mustache" },
  "a team's welcome letter replaces the level's",
);
test.assertDeepEqual(tmpl.thingsProject, { templateFile: "bvr/custom.mustache" }, "game-day project override");
test.assertDeepEqual(
  tmpl.teamTemplateTags,
  {
    hc_year: "2nd",
    ac_name: "Alex Able",
    ac_email: "alex@example.com",
    ac_names: "Alex Able",
    assistants: [{ name: "Alex Able", email: "alex@example.com" }],
    attendance_email: "attendance@example.com",
  },
  "plain tags plus the assistant coach and attendance office",
);

// --- coaches ---
test.section("coaches");

const coachStaff = new Staff({
  HC: { name: "Hana Cole", email: "hana@example.com", coachingSince: "2016-02-29", headCoachSince: { ultimate: "2021-02-22" } },
  AA: { name: "Alex Able", email: "alex@example.com", coachingSince: "2022-02-28" },
  BB: { name: "Bea Bell", email: "bea@example.com" },
  CC: { name: "Cy Cole", email: "cy@example.com" },
  OT: { name: "Oli Tan", email: "oli@example.com" },
});
const coachConfig = (team, seasonCoaches) =>
  new TeamConfig({
    team: { ...baseTeam, sport: "ultimate", ...team },
    level, forms, staff: coachStaff, attendanceOffice: "ATT", headCoach: "HC",
  }).withSeason({ coaches: seasonCoaches });
const yearTag = (date) => BVRUtilities.ordinal(BVRUtilities.yearCount(date));

test.assertDeepEqual(coachConfig({}).coaches, { head: "HC", assistants: [] }, "no headCoach in teams.yaml → the usual head coach");
test.assertDeepEqual(
  coachConfig({ headCoach: "OT", assistantCoaches: ["HC"] }).coaches,
  { head: "OT", assistants: ["HC"] },
  "teams.yaml headCoach and assistants",
);
test.assertDeepEqual(
  coachConfig({ assistantCoaches: ["AA"] }, { assistants: ["BB", "CC"] }).coaches,
  { head: "HC", assistants: ["BB", "CC"] },
  "a season override replaces only the keys it sets",
);
test.assertDeepEqual(
  coachConfig({ assistantCoaches: ["AA"] }, null).coaches,
  { head: "HC", assistants: ["AA"] },
  "a null season override keeps the team's",
);

const tags = coachConfig({ assistantCoaches: ["AA", "BB"] }).coachTags;
test.assertEqual(tags.hc_name, "Hana Cole", "hc_name from the head coach");
test.assertEqual(tags.hc_email, "hana@example.com", "hc_email from the head coach");
test.assertEqual(tags.hc_years_coaching, yearTag("2016-02-29"), "hc_years_coaching from coachingSince");
test.assertEqual(tags.hc_year, yearTag("2021-02-22"), "hc_year from headCoachSince for the team's sport");
test.assertEqual(tags.ac_name, "Alex Able", "ac_name is the first assistant");
test.assertEqual(tags.ac_names, "Alex Able and Bea Bell", "ac_names lists every assistant");
test.assertEqual("ac_years_coaching" in tags, false, "no ac_years_coaching tag");
test.assertDeepEqual(
  tags.assistants,
  [{ name: "Alex Able", email: "alex@example.com" }, { name: "Bea Bell", email: "bea@example.com" }],
  "assistants lists each one for Mustache",
);
test.assertEqual(tags.ac_many, true, "ac_many with two or more assistants");
test.assertEqual("ac_many" in coachConfig({ assistantCoaches: ["AA"] }).coachTags, false, "no ac_many with one");

const soccerTags = coachConfig({ sport: "soccer" }).coachTags;
test.assertEqual("hc_year" in soccerTags, false, "no headCoachSince for the sport → no hc_year");
test.assertEqual("ac_names" in soccerTags, false, "no assistants → no ac tags");
test.assertEqual(coachConfig({ headCoach: "OT" }).coachTags.hc_name, "Oli Tan", "the team's head coach replaces the usual one");
test.assertEqual("hc_years_coaching" in coachConfig({ headCoach: "OT" }).coachTags, false, "no coachingSince → no hc_years_coaching");
test.assertEqual(
  coachConfig({}, { head: "OT" }).templateSettings.teamTemplateTags.hc_name,
  "Oli Tan",
  "teamTemplateTags carry the season's coaches",
);

const noEmail = new TeamConfig({
  team: { ...baseTeam, sport: "ultimate", assistantCoaches: ["NE"] },
  level, forms, staff: new Staff({ HC: { name: "Hana Cole" }, NE: { name: "No Email" } }), attendanceOffice: "ATT", headCoach: "HC",
}).coachTags;
test.assertEqual(noEmail.hc_email, "", "a head coach without an email gives a blank hc_email, not the usual one's");
test.assertEqual(noEmail.ac_email, "", "an assistant without an email does not stop the templates");
test.assertDeepEqual(
  TeamConfig.coachOverrides({ head: "HC", assistants: ["BB", "AA"] }, { head: "HC", assistants: ["AA", "BB"] }),
  { assistants: ["BB", "AA"] },
  "a new assistant order is saved, since the first gives ac_name",
);

test.assertEqual(TeamConfig.joinNames(["A"]), "A", "one name");
test.assertEqual(TeamConfig.joinNames(["A", "B", "C"]), "A, B, and C", "three names");

const coachDefaults = { head: "HC", assistants: ["AA"] };
test.assertDeepEqual(TeamConfig.typedCoaches({ headCoach: "", assistantCoaches: " " }, coachDefaults), coachDefaults, "blank fields keep the defaults");
test.assertDeepEqual(
  TeamConfig.typedCoaches({ headCoach: "ot, hc", assistantCoaches: "bb; cc" }, coachDefaults),
  { head: "OT", assistants: ["BB", "CC"] },
  "only the first head coach initials count",
);
test.assertEqual(TeamConfig.coachOverrides({ head: "HC", assistants: ["AA"] }, coachDefaults), null, "matching the defaults → null");
test.assertDeepEqual(
  TeamConfig.coachOverrides({ head: "HC", assistants: ["BB"] }, coachDefaults),
  { assistants: ["BB"] },
  "only what differs is saved",
);

// --- email ---
test.section("email messages");

team = new TeamConfig({
  team: baseTeam,
  level: { attendance: { absences: { type: "email", recipients: ["ATT"], ccRecipients: ["AA", "BB"], subjectLine: "S", bodyText: "B" } } },
  forms,
  staff,
});
test.assertDeepEqual(
  team.attendanceSettings.absencesMsgConfig,
  { type: "email", recipients: ["attendance@example.com"], ccRecipients: ["alex@example.com", "bea@example.com"], subjectLine: "S", bodyText: "B" },
  "email recipients and cc become addresses",
);
test.assertEqual(team.attendanceSettings.noAbsencesMsgConfig, undefined, "a level without noAbsences sends none");
test.assertDeepEqual(team.formNames, [], "no forms when neither level nor team lists any");

// --- attendance form ---
test.section("attendance form");

test.assertEqual(config({}).attendanceSettings.formSettings, undefined, "no attendance form unless the level or team names one");
team = new TeamConfig({
  team: { ...baseTeam, attendance: { formTeam: "Varsity Hoops" } },
  level: { attendance: { form: "long-form" } },
  forms,
  staff,
});
test.assertDeepEqual(
  team.attendanceSettings,
  {
    absencesMsgConfig: undefined,
    noAbsencesMsgConfig: undefined,
    formSettings: { name: "long-form", title: "Long form", postData: false, fields: [{ key: "opponent", entryID: 2 }] },
    formTeam: "Varsity Hoops",
  },
  "the level's form and the team's dropdown value, with no messages",
);
test.assertThrows(
  () => config({ attendance: { form: "nope" } }).attendanceSettings,
  "an unknown attendance form names itself",
  "no form named nope",
);

// --- errors ---
test.section("errors");

test.assertThrows(
  () => config({ attendance: { absences: { recipients: ["AA", "XX", "YY"] } } }).attendanceSettings,
  "unknown initials name themselves",
  "XX, YY",
);
test.assertThrows(
  () => config({ attendance: { absences: { type: "email", recipients: ["CC"] } } }).attendanceSettings,
  "a missing contact field names the person and field",
  "no email for CC",
);
test.assertThrows(() => config({ forms: ["nope"] }).gameReportSettings, "an unknown form names itself and the team", "no form named nope (listed for test-hoops)");
test.assertEqual(config({ assistantCoaches: ["BB"] }).teamTemplateTags.ac_name, "", "an assistant coach without a name gives a blank ac_name");

// --- season recipients ---
test.section("season recipients");

team = config({ attendance: { absences: { recipients: ["CC"] } } });
test.assertDeepEqual(team.defaultRecipients, { attendance: ["CC"], gameReport: ["AA"] }, "defaults come from the team override, else the level");
test.assertDeepEqual(team.recipients, team.defaultRecipients, "with no season override, the defaults are in effect");

let seasonal = team.withSeasonRecipients({ attendance: ["BB"] });
test.assertDeepEqual(seasonal.recipients, { attendance: ["BB"], gameReport: ["AA"] }, "a season list replaces only its own list");
test.assertDeepEqual(
  seasonal.attendanceSettings.absencesMsgConfig,
  { type: "text", recipients: ["555-0102"], bodyText: "Absent from [[team_name]]: " },
  "season attendance recipients beat the team override, and keep the text",
);
test.assertDeepEqual(seasonal.attendanceSettings.noAbsencesMsgConfig.recipients, ["555-0102"], "for both attendance messages");
test.assertDeepEqual(seasonal.gameReportSettings.messageSettings[0].recipients, ["555-0101"], "score messages keep their default");
test.assertDeepEqual(team.attendanceSettings.absencesMsgConfig.recipients, ["555-0103"], "the original config is unchanged");

seasonal = team.withSeasonRecipients({ gameReport: ["BB", "CC"] });
test.assertDeepEqual(seasonal.gameReportSettings.messageSettings[0].recipients, ["555-0102", "555-0103"], "a season score list replaces the message recipients");

const emailTeam = new TeamConfig({
  team: baseTeam,
  level: { attendance: { absences: { type: "email", recipients: ["ATT"], ccRecipients: ["AA"], subjectLine: "S", bodyText: "B" } } },
  forms,
  staff,
}).withSeasonRecipients({ attendance: ["BB"] });
test.assertDeepEqual(
  emailTeam.attendanceSettings.absencesMsgConfig,
  { type: "email", recipients: ["bea@example.com"], ccRecipients: ["alex@example.com"], subjectLine: "S", bodyText: "B" },
  "for email, the season list replaces recipients and leaves cc alone",
);
test.assertDeepEqual(config({}).withSeasonRecipients(null).recipients, { attendance: ["AA", "BB"], gameReport: ["AA"] }, "a null season override means the defaults");
test.assertEqual(config({}).templateSettings.attendance.templateFile, "bvr/attendance.md", "the roster template defaults to bvr/attendance.md");
test.assertDeepEqual(
  config({}).templateSettings.endOfSeasonProject,
  { templateFile: "bvr/end-of-season-project.mustache" },
  "the end-of-season project defaults to bvr/end-of-season-project.mustache",
);
test.assertEqual(
  config({ templates: { endOfSeasonProject: "bvr/custom-end.mustache" } }).templateSettings.endOfSeasonProject.templateFile,
  "bvr/custom-end.mustache",
  "end-of-season project override",
);

// --- TmplSettings level tags ---
test.section("TmplSettings level tags");

// TmplSettings returns a plain settings object from its constructor.
const levelTags = (teamLevel) => /** @type {any} */ (new TmplSettings({ teamLevel, defaultDraftTags: [] }, {})).templateTags;
test.assertEqual(levelTags("us").level_us, true, "an upper school team gets level_us");
test.assertFalsy(levelTags("us").level_ms, "and not level_ms");
test.assertEqual(levelTags("ms").level_ms, true, "a middle school team gets level_ms");
test.assertFalsy(levelTags("ms").level_us, "and not level_us");

// --- weekly schedule ---
test.section("weekly schedule");

const weeklyLevel = { ...level, weeklySchedule: { practiceTime: "2:35 - 3:35" } };
const weeklyConfig = (team) =>
  new TeamConfig({ team: { ...baseTeam, ...team }, level: weeklyLevel, forms, staff, attendanceOffice: "ATT" });
test.assertEqual(weeklyConfig({}).weeklySchedule.practiceTime, "2:35 - 3:35", "the practice time comes from the level");
test.assertEqual(
  weeklyConfig({ weeklySchedule: { practiceTime: "3:00 - 4:30" } }).weeklySchedule.practiceTime,
  "3:00 - 4:30",
  "a team overrides the practice time",
);
test.assertDeepEqual(config({}).weeklySchedule, {}, "no weeklySchedule settings is an empty object");
test.assertDeepEqual(
  config({}).templateSettings.weeklySchedule,
  {
    templateFile: "bvr/weekly-schedule.mustache",
    draftTags: ["bvr/hoops/ms/weekly-email"],
    summaryPrompt: "bvr/weekly-summary-prompt.mustache",
  },
  "the weekly email template and tag follow from defaultTag",
);
test.assertEqual(
  config({ templates: { weeklySchedule: "bvr/custom-week.mustache" } }).templateSettings.weeklySchedule.templateFile,
  "bvr/custom-week.mustache",
  "teams.yaml overrides the weekly email template",
);
test.assertDeepEqual(config({ assistantCoaches: ["BB", "AA"] }).assistantCoaches, ["BB", "AA"], "assistantCoaches lists initials in order");
test.assertDeepEqual(config({}).assistantCoaches, [], "no assistants is an empty list");

// --- Staff ---
test.section("Staff");

test.assertDeepEqual(staff.contacts(["BB", "AA"], "cell"), ["555-0102", "555-0101"], "contacts keep the given order");
test.assertEqual(staff.contact("ATT", "email"), "attendance@example.com", "contact returns one field");
test.assertEqual(staff.has("ZZ"), false, "has is false for unknown initials");
test.assertEqual(new Staff(undefined).has("AA"), false, "an empty directory has no one");
test.assertDeepEqual(Staff.parseInitials(" ag, HM;wk  ag "), ["AG", "HM", "WK"], "parseInitials splits, uppercases, and drops repeats");
test.assertDeepEqual(Staff.parseInitials(""), [], "a blank field parses to no initials");
test.assertDeepEqual(staff.unknown(["AA", "XX", "BB", "YY"]), ["XX", "YY"], "unknown lists the initials no one has");
test.assertEqual(staff.coachName("BB"), "Coach Bea", "coachName is the coachName field when set");
test.assertEqual(staff.coachName("AA"), "Alex Able", "coachName falls back to the full name");
test.assertThrows(() => staff.coachName("CC"), "coachName throws for someone with neither");

test.summary();
