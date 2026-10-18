---
teamTemplateTags:
  hc_year: 4th
  ac_name: "{{ op://BVR/DG/first name }} {{ op://BVR/DG/last name }}"
  ac_email: op://BVR/DG/email
  ac_years_coaching: 4th
  attendance_email: op://BVR/ATT/email
reportTemplate:
  draftTags:
    - bvr/ultimate/ms/game/recap
  templateFile: bvr/game-report.md
recordTemplate:
  templateFile: bvr/game-record-row.md
practicePlan:
  draftTags:
    - bvr/ultimate/ms/practice/plan
seasonRecord:
  templateFile: bvr/game-season-record.md
gameReport:
  templateFile: bvr/game-report.md
  draftTags:
    - bvr/ultimate/ms/game/recap
recordRow:
  templateFile: bvr/game-record-row.md
