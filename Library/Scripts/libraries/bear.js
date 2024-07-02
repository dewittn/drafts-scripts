function bearTags(d = draft) {
  let tags = d.tags;

  tags.forEach((tag, index) => {
    const endText = /\s/.test(tag) ? "#" : "";
    tags[index] = `#${capitalizeTag(tag)}${endText}`;
  });
  tags.push("#_inbox");

  d.setTemplateTag("bearTags", tags.join(" "));
}

function updateWikiLinks(d = draft) {
  d.content = d.content.replace(/\[\[bear:/g, "[[");
  d.update();
}

function capitalizeTag(tag) {
  return tag.replace(/(?:^|\s|["'([{])+\S/g, (match) => match.toUpperCase());
}
