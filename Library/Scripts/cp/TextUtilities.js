class TextUltilities {
  constructor() {}

  // Converts string to Title Case
  titleCase(string) {
    if (string == undefined) return undefined;

    return string
      .toLowerCase()
      .split(/([\s.\/])/g)
      .map((str) => this.capitalize(str))
      .join("");
  }

  // Converts a title to slug by replacing ' ' with '-'
  convertTitleToSlug(title) {
    if (title == undefined) return "";

    const removeChars = new RegExp(/[:\\"'\\?\\(\\)-,]/, "g");
    return title.toLowerCase().replace(removeChars, "").replace(/[ ]+/g, "-");
  }

  // Removes destination prefixes from Title
  scrubTitle(title, scrubText) {
    if (scrubText == undefined) return title;

    const regEx = new RegExp(scrubText, "ig");
    return title.replace(regEx, "");
  }

  capitalize(string) {
    return string.replace(/\w\S*/g, (w) => w.replace(/^\w/, (c) => c.toUpperCase()));
  }

  capitalizeTags(tags) {
    return tags.map((tag) => this.capitalize(tag));
  }

  // Converts MultiMakdown into Markdown XL
  convertMarkdown(content) {
    // Converts highlight tags `{==` and `==}` into `::`
    return content.replace(/\{==/g, "::").replace(/==\}/g, "::");
  }
}
