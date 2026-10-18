---
attendanceDraftID: BE66E397-6DDE-44E4-AAF0-31A80DD64B4F
absencesMsgConfig:
  type: text
  recipients:
    - op://BVR/CK/cell
    - op://BVR/AJ/cell
  bodyText: "These students are absent from [[team_name]] today: "
noAbsencesMsgConfig:
  type: text
  recipients:
    - op://BVR/CK/cell
    - op://BVR/AJ/cell
  bodyText: "No one is absent from [[team_name]] today."