class TmplSettings {
  constructor(gblTmplSettings, settings, game = {}) {
    const templateSettings = {
      ...settings,
      templateTags: {
        ...gblTmplSettings.globalTemplateTags,
        ...gblTmplSettings.teamTemplateTags,
        team_name: gblTmplSettings.teamName,
        team_abbr: gblTmplSettings.teamAbbr,
        // For Mustache sections that only one level gets, e.g. {{#level_us}}.
        // Other levels' tags are missing, which Mustache treats as false.
        ...TmplSettings.#levelTag(gblTmplSettings.teamLevel),
        // Empty, never "null", for a team file with no current season yet.
        current_season: `${gblTmplSettings.currentSeasonID ?? ""}`,
        current_season_label: `${gblTmplSettings.currentSeasonLabel ?? gblTmplSettings.currentSeasonID ?? ""}`,
        game_date: game.formattedDate,
        game_report_due_date: game.reportDueDate,
        game_location: game.location,
        game_isHome: game.isHome,
        game_opponent: game.opponent,
        game_result: game.result,
        game_score: game.fullScore,
        game_score_us: game.scoreUs,
        game_score_them: game.scoreThem,
        game_description: game.description,
        game_summary: game.summary,
        game_highlights: game.highlights,
        game_comments: game.comments,
      },
    };
    templateSettings.draftTags =
      templateSettings.draftTags == undefined
        ? gblTmplSettings.defaultDraftTags
        : [...gblTmplSettings.defaultDraftTags, ...templateSettings.draftTags];
    return templateSettings;
  }

  // { level_<level>: true } for the team's level, or nothing without one.
  static #levelTag(teamLevel) {
    return teamLevel == undefined ? {} : { [`level_${teamLevel}`]: true };
  }
}
