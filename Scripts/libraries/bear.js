function bearTags() {
  let tags = draft.tags;

  tags.forEach((tag, index) => {
    const endText = /\s/.test(tag) ? "#" : "";
    tags[index] = `#${capitalize(tag)}${endText}`;
  });
  tags.push("#_inbox");

  draft.setTemplateTag("bearTags", tags.join(" "));
}

function updateWikiLinks() {
  draft.content = draft.content.replace(/\[\[bear:/g, "[[");
  draft.update();
}
