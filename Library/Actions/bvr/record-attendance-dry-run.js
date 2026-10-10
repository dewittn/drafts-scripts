// TEMPORARY test action: runs the real attendance flow but skips sending the
// message and the completion shortcut. Reports which Attendance.js is loaded
// so the version running on this device is unambiguous.
const oneSecond = 10000;
const recentlyCreated = new Date() - draft.createdAt < oneSecond;
const teamID = recentlyCreated ? draft.content : "";

require("shared/core/ServiceInitializer.js");
initializeServices();

const container = ServiceContainer.getInstance();
const team = container.get("teamFactory")(teamID);

const submitAttendace = team.takeAttendace();

// Attendance class is loaded lazily by takeAttendace(), so check it here.
const fmCloud = FileManager.createCloud();
const modified = fmCloud.getModificationDate("/Library/Scripts/modules/bvr/core/Attendance.js");
const hasEditorFix = Attendance.prototype.submitted.toString().includes("editor.setText");
const hasDryRun = Attendance.prototype.submit.toString().includes("dryRun");
const hasLoadDraftFix = Attendance.prototype.toString().includes("this.loadDraft()")
  || Object.getOwnPropertyNames(Attendance.prototype).includes("loadDraft");
const attendaceDraft = team.attendace.attendaceDraft;
alert(
  `Attendance.js modified: ${modified}\n` +
    `editor.setText fix present: ${hasEditorFix}\n` +
    `dryRun support present: ${hasDryRun}\n` +
    `loadDraft helper present: ${hasLoadDraftFix}\n` +
    `Open draft uuid: ${draft.uuid}\n` +
    `Attendance draft uuid: ${team.attendanceDraftID}\n` +
    `Open draft is attendance draft: ${draft.uuid == team.attendanceDraftID}\n` +
    `Attendance object holds global draft: ${attendaceDraft === draft}\n` +
    `Proceed to submit (dry run): ${submitAttendace}`,
);

if (submitAttendace) team.submitAttendace({ dryRun: true });
