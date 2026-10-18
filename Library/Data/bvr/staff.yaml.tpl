---
# The only BVR file with personal contact details. Every other BVR file names
# people by these initials. Each entry has only the fields some message or
# template uses. `bun run inject` renders this to staff.yaml (deleted after
# sync) and staff.json; neither is ever committed.
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
  HM:
    cell: op://BVR/HM/cell
  ME:
    name: "{{op://BVR/ME/first name}} {{op://BVR/ME/last name}}"
    email: op://BVR/ME/email
  WK:
    cell: op://BVR/WK/cell
