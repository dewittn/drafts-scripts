if (typeof FormLinkStore == "undefined") require("modules/bvr/storage/FormLinkStore.js");

// A season's score-form links: its own formURLs (overrides) and its term's
// shared links (bvr/formLinks.json). Reads the Season's store and shared
// links only when used, so a team on the old files never loads formLinks.json.
class SeasonFormLinks {
  #season;

  // season: the team's Season, for its store and formLinks.
  constructor(season) {
    this.#season = season;
  }

  // The link in effect for a form and where it comes from: the season's own
  // formURLs ("season"), the term's shared links ("term"), or nowhere.
  effective(formName, seasonURLs, term) {
    const own = (seasonURLs || {})[formName];
    if (own) return { url: own, source: "season" };
    const shared = term == undefined ? undefined : this.#season.formLinks.link(term, formName);
    if (shared) return { url: shared, source: "term" };
    return { url: undefined, source: undefined };
  }

  // The one rule for new links: on the season when it overrides the form or has
  // no term, else shared for the term. Sets the shared ones (caller saves).
  place(term, seasonURLs, links) {
    const placed = { season: {}, shared: [] };
    for (const [formName, url] of Object.entries(links)) {
      if (term == undefined || (seasonURLs || {})[formName]) {
        placed.season[formName] = url;
        continue;
      }
      this.#season.formLinks.setLink(term, formName, url);
      placed.shared.push(formName);
    }
    return placed;
  }

  // Season links from before links were shared move up to a term that lacks
  // them (one save of each file); one that differs stays, as an override.
  liftSeasonLinks(seasonID) {
    const term = FormLinkStore.termFor(seasonID);
    if (term == undefined) return;
    const store = this.#season.store;
    const seasonURLs = store.seasonFor(seasonID)?.formURLs || {};
    if (Object.keys(seasonURLs).length == 0) return;

    const formLinks = this.#season.formLinks;
    const lifted = Object.keys(seasonURLs).filter((formName) => {
      const shared = formLinks.link(term, formName);
      if (shared == undefined) formLinks.setLink(term, formName, seasonURLs[formName]);
      return shared == undefined || shared == seasonURLs[formName];
    });
    if (lifted.length == 0) return;

    const remaining = { ...seasonURLs };
    lifted.forEach((formName) => delete remaining[formName]);
    formLinks.save();
    store.updateSeason(seasonID, { formURLs: remaining });
    store.save();
  }
}
