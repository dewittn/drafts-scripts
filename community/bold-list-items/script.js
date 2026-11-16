require("modules/nr/BoldListItems.js");

// Bold List Items: bolds the short label that leads each list item, so
// "- Evernote. They do…" becomes "- **Evernote.** They do…".
//
// Settings come from Define Template Tag steps placed before this Script step.
// Leave a tag out to use its default.
//
//   bold_separators  Which symbols end a label, any of  . : -   Default: .:-
//   bold_periods     names: bold a period label only when it is written like a
//                    name ("Evernote.", "Turning Point."), so ordinary sentences
//                    are left alone. any: bold the words before every period.
//                    Default: names
//   bold_max_words   The most words a label may have. Blank for no limit.
//                    Default: blank

// The value of a template tag, or fallback when the action leaves it out.
function setting(tag, fallback) {
  const value = draft.getTemplateTag(tag).trim();
  return value === "" ? fallback : value;
}

const { defaults } = BoldListItems;
const bolder = new BoldListItems({
  separators: setting("bold_separators", defaults.separators),
  periodNamesOnly: setting("bold_periods", "names") != "any",
  maxWords: Number(setting("bold_max_words", "")) || null,
});

draft.content = bolder.text(draft.content);
draft.update();
editor.activate();
