/**
 * Bold Bullet Points
 *
 * Script that bolds the first part of a bullet or number list. Use full for making points standout.
 */

// Settings you can change
var settings = {
  bullets: "[-*]",
  numbers: "[\\d]+\\.",
  includedSybmols: ["\\.", ":"],
  excultedSymbols: [" -", " \\^"],
  maxWords: "5",
};

// Creates logic to ignore items that are already bold, and sets the max word limit
var noBold = "(?!\\*\\*)";
var wordSearch = "(?:\\w+\\s?){1," + settings.maxWords + "}";

// Capture groups to be used in the replace function below
// group1 corresponds to $1 in .replace(), group2 to $2 and so on
var group1 = "(" + settings.bullets + "|" + settings.numbers + ") ";
var group2 =
  "(" + wordSearch + "(?:" + settings.includedSybmols.join("|") + "))";
var group3 = "(" + wordSearch + ")";
var group4 = "(" + settings.excultedSymbols.join("|") + ")";

// Generates the Regular Expression used for replace()
// For example:  /^([-*]|[\d]+\.) (?!\*\*)(?:((?:\w+\s?){1,5}[.:])|((?:\w+\s?){1,5})( [-]))/
var regEx = new RegExp(
  "^" + group1 + noBold + "(?:" + group2 + "|" + group3 + group4 + ")"
);

// Searches through draft content for bullet points or numbered lists and wraps first part of the text with bold `**`
function boldListItems(lines) {
  for (index in lines) {
    lines[index] = lines[index].replace(regEx, "$1 **$2$3**$4");
  }
  return lines.join("\n");
}

// Run draft through script and update content
draft.content = boldListItems(draft.lines);
draft.update();

// Return to editor
editor.activate();
