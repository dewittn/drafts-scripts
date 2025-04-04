---
messageSettings:
  - type: text
    recipients:
      - op://BVR/CK/cell
    bodyText: "[[game_summary]]"
  - type: text
    recipients:
      - op://BVR/CK/cell
    bodyText: "[[game_highlights]]"
googleFormSettings:
  url: op://BVR/Score Report/MSUF
  postData: true
  fields:
    - key: teamName
      title: Team
      entryID: 2066576502
    - key: googleFormDate
      title: Date of Contest
      entryID: 2108682401
    - key: opponent
      title: Opponent
      entryID: 1269407546
    - key: location
      title: Location
      entryID: 542234752
    - key: result
      title: Result
      entryID: 936144083
      options:
        - Win
        - Loss
        - Draw
    - key: scoreUs
      title: BVR
      entryID: 1101471948
    - key: scoreThem
      title: Them
      entryID: 1320101693
    - key: highlights
      title: Highlights?
      message: Check for grammar and spelling. Please include some statistical info if possible
      entryID: 211909310
