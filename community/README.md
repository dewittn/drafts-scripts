# Community actions

Shareable versions of actions from this repo, for the Drafts Directory. A shared
action can't `require()` repo files, so each one is built into a single script.

- Edit `community/<name>/script.js` and the modules it requires.
- Run `bun run community` to rebuild `community/<name>/<name>.js`.
- Paste the built file into the action's Script step.

## Bold List Items

Bolds the short label that leads each list item: `- Evernote. They do…` becomes
`- **Evernote.** They do…`.

Action steps, in order:

1. **Define Template Tag** `bold_separators`, value `.:-`. Which symbols end a label.
2. **Define Template Tag** `bold_periods`, value `names`. `names` bolds a period
   label only when it is written like a name (`Evernote.`, `Turning Point.`).
   `any` bolds the words before every period.
3. **Define Template Tag** `bold_max_words`, value left blank. The most words a
   label may have; blank for no limit.
4. **Script**: the contents of `bold-list-items/bold-list-items.js`.

Any tag step can be left out to use its default.
