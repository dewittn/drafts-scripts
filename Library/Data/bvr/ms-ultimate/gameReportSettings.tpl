---
messageSettings:
  - type: text
    recipients:
      - op://BVR/AG/cell
      - op://BVR/AH/cell
    bodyText: "[[game_summary]]"
googleFormSettings:
  - url: op://BVR/Score Report/MSUF
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
  - url: op://BVR/Score Report/VUF
    postData: false
    fields:
      - key: teamName
        title: Team
        entryID: 1633228220
      - key: hcName
        title: Your Name
        entryID: 1506871634
      - key: formattedDate
        title: Date of Contest
        entryID: 1355820554
      - key: opponent
        title: Opponent
        entryID: 1263048397
      - key: result
        title: Result
        entryID: 702349070
        options:
          - Win
          - Loss
          - Draw
      - key: fullScore
        title: Score
        entryID: 2100816744
      - key: highlights
        title: Highlights?
        message: Check for grammar and spelling. Please include some statistical info if possible
        entryID: 1620020605
      - key: reported
        title: Report the score?
        message: "Did you report the score to the Boston Globe (617-929-3235) and Boston Herald: hssports@bostonherald.com"
        entryID: 999954584
        options:
          - "Yes"
          - "Not applicable (non-varsity team)"
      - key: comments
        title: Other/Comments
        message: (Any notes about refs, buses, etc)
        entryID: 544469491