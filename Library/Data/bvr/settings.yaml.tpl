---
dirPrefix: bvr/
uiSettingsFile: ui.json
teamSettingsFile: teams.json
ppSettingsFile: practicePlans.json
recordsFile: records.json
ppDataFile: practicePlans.json
teamFilesDir: teams/
formLinksFile: formLinks.json
staffFile: staff.json
formsFile: forms.json
levelsDir: levels/
defaultTemplateFile: practice-plan.md
weekIDTemplateTag: week_id
workspace: BVR
coachingDraftID: 4BDFFB76-6271-4B64-A9BD-A01D0D4583E8
msgTeamNameTag: team_name
# Initials in staff.yaml.tpl. hc_name and hc_email come from headCoach, and
# the attendance_email template tag from attendanceOffice.
headCoach: ME
attendanceOffice: ATT
# The model that writes generated text, such as the weekly email's opening
# (see shared/libraries/LanguageModel.js). apple: mode onDevice or pcc
# (Private Cloud Compute). anthropic: model, maxTokens, and thinking (false
# turns it off), with the API key in Drafts' credentials. Remove it to skip generated text.
languageModel:
  provider: anthropic
  model: claude-haiku-5-5
  thinking: false
globalTemplateTags:
  hc_years_coaching: 9th
