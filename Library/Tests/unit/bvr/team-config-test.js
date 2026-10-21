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

const test = new TestAssertions("TeamConfig and Staff");

const staff = new Staff({
  AA: { name: "Alex Able", cell: "555-0101", email: "alex@example.com" },
  BB: { cell: "555-0102", email: "bea@example.com" },
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
  new TeamConfig({ team: { ...baseTeam, ...team }, level, forms, staff, templateExists });

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
test.assertEqual(tmpl.welcomeLetter, undefined, "no welcome letter unless teams.yaml names one");
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
test.assertDeepEqual(tmpl.thingsProject, { templateFile: "bvr/custom.mustache" }, "game-day project override");
test.assertDeepEqual(
  tmpl.teamTemplateTags,
  { hc_year: "2nd", ac_name: "Alex Able", ac_email: "alex@example.com", attendance_email: "attendance@example.com" },
  "plain tags plus the assistant coach and attendance office",
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
test.assertThrows(() => config({ assistantCoaches: ["BB"] }).teamTemplateTags, "an assistant coach needs a name", "no name for BB");

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
test.assertEqual(levelTags("us").level_ms, false, "and not level_ms");
test.assertEqual(levelTags("ms").level_ms, true, "a middle school team gets level_ms");
test.assertEqual(levelTags("ms").level_us, false, "and not level_us");

// --- Staff ---
test.section("Staff");

test.assertDeepEqual(staff.contacts(["BB", "AA"], "cell"), ["555-0102", "555-0101"], "contacts keep the given order");
test.assertEqual(staff.contact("ATT", "email"), "attendance@example.com", "contact returns one field");
test.assertEqual(staff.has("ZZ"), false, "has is false for unknown initials");
test.assertEqual(new Staff(undefined).has("AA"), false, "an empty directory has no one");
test.assertDeepEqual(Staff.parseInitials(" ag, HM;wk  ag "), ["AG", "HM", "WK"], "parseInitials splits, uppercases, and drops repeats");
test.assertDeepEqual(Staff.parseInitials(""), [], "a blank field parses to no initials");
test.assertDeepEqual(staff.unknown(["AA", "XX", "BB", "YY"]), ["XX", "YY"], "unknown lists the initials no one has");

test.summary();
