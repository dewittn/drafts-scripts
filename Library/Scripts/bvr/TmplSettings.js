class TmplSettings {
  constructor(gblTmplSettings, settings, game = {}) {
    const templateSettings = {
      ...settings,
      templateTags: {
        ...gblTmplSettings.globalTemplateTags,
        team_name: gblTmplSettings.teamName,
        team_abbr: gblTmplSettings.teamAbbr,
        current_season: `${gblTmplSettings.currentSeasonID}`,
        game_date: game.formattedDate,
        game_location: game.location,
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
}
