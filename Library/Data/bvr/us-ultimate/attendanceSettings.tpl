---
attendanceDraftID: 5E1337A5-F964-4DEC-95A8-091AE789F0B1
absencesMsgConfig:
  type: email
  recipients:
    - op://BVR/ATT/email
  ccRecipients:
    - op://BVR/AG/email
    - op://BVR/AH/email
  subjectLine: Attendance for [[team_name]] ([[date|%m-%d-%Y]])
  bodyText: "Hello,\n\nThese students are absent from [[team_name]] today:\n\n"
