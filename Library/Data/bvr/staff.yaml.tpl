---
# The only BVR file with personal contact details. Every other BVR file names
# people by these initials. Each entry has only the fields some message or
# template uses. `bun run inject` renders this to staff.yaml (deleted after
# sync) and staff.json; neither is ever committed.
# Coaches can also have coachingSince (hc_years_coaching) and headCoachSince,
# one date per sport (hc_year): quoted "YYYY-MM-DD", each anniversary starting
# the next year. Pick a date a little before the season, so a welcome letter
# written ahead of it already counts the new year.
people:
  AG:
    cell: op://BVR/AG/cell
    email: op://BVR/AG/email
  AH:
    cell: op://BVR/AH/cell
    email: op://BVR/AH/email
  AJ:
    cell: op://BVR/AJ/cell
  AN:
    cell: op://BVR/AN/cell
  ATT:
    email: op://BVR/ATT/email
  CK:
    cell: op://BVR/CK/cell
  DG:
    name: "{{ op://BVR/DG/first name }} {{ op://BVR/DG/last name }}"
    email: op://BVR/DG/email
    cell: op://BVR/DG/cell
    coachingSince: "2022-02-28"
  HM:
    cell: op://BVR/HM/cell
  ME:
    name: "{{op://BVR/ME/first name}} {{op://BVR/ME/last name}}"
    coachName: Coach Nelson
    email: op://BVR/ME/email
    coachingSince: "2016-02-29"
    headCoachSince:
      ultimate: "2021-02-22"
      basketball: "2026-11-09"
  WK:
    name: "{{ op://BVR/WK/first name }} {{ op://BVR/WK/last name }}"
    email: op://BVR/WK/email
    cell: op://BVR/WK/cell
