---
recordsDraftID: 6A0F43B4-84E4-40F3-8E73-DDEA573DA0D6
messageSettings:
  - type: text
    recipients:
      - op://BVR/AG/cell
      - op://BVR/AH/cell
    bodyText: "[[game_summary]]"
googleFormSettings:
  url: op://BVR/VUF/gform-url
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
