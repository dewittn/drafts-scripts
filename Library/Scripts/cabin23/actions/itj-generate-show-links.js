// See online documentation for examples
// https://docs.getdrafts.com/docs/actions/scripting
const baseDomain = "cabin23productions.com";
const showLinks = [];
const showDict = {};

function extractLinkInfo(text) {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  //const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const title = match[1];
    const url = match[2];
    return { title, url };
  }

  return;
}

function isDomainInUrl(url, domain) {
  if (url == undefined) return false;

  const regex = new RegExp(`^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?${domain}(?:[\/\?#]|$)`, "i");
  return regex.test(url);
}

function generateSlug(title) {
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove non-word characters except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace consecutive hyphens with a single hyphen
    .trim(); // Trim leading and trailing spaces

  return slug;
}

function keyFromShowTitle(title) {
  const showSlug = generateSlug(title);
  const words = showSlug.split("-");
  return words.slice(0, 2).join("-");
}

function saveShowLinkToJSON() {
  draft.lines.forEach((line, index) => {
    const linkInfo = extractLinkInfo(line);
    if (isDomainInUrl(linkInfo?.url, baseDomain)) showLinks.push(linkInfo);
  });

  showLinks.forEach(({ title, url }) => {
    showDict[keyFromShowTitle(title)] = url;
  });

  let fmCloud = FileManager.createCloud();
  fmCloud.writeJSON("/Library/Data/itj.json", showDict);
}

function loadGhostData(fileName) {
  let fmCloud = FileManager.createCloud();
  return fmCloud.readJSON(`/Library/Data/${fileName}`);
}

function createNginxRedirects() {
  const wpData = loadGhostData("wp_ghost_export.json");
  const ghostData = loadGhostData("itj.json");
  const posts = wpData?.data?.posts.filter((item) => item.type == "post");
  const showTitles = [];
  const showKeys = [];
  const d = new Draft();

  posts.forEach((post) => {
    if (post.title.match("Episode")) {
      const titleKey = keyFromShowTitle(post.title);
      d.content = d.content + `location ~ ${post.slug} { return 301 ${ghostData[titleKey]}; }\n`;
    }
  });

  d.update();
}

const wpData = loadGhostData("wp_ghost_export.json");
const ghostData = loadGhostData("itj.json");
const posts = wpData?.data?.posts.filter((item) => item.type == "post");
const showTitles = [];
const showKeys = [];
const d = new Draft();
d.content = "301:\n";

posts.forEach((post) => {
  if (post.title.match("Episode")) {
    const titleKey = keyFromShowTitle(post.title);
    const newURL = `${ghostData[titleKey]}`;
    const newSlug = newURL.replace("https://cabin23productions.com/inside-the-journey", "");
    if (`/${post.slug}/` != newSlug) {
      d.content = d.content + `  /${post.slug}/: ${newSlug}\n`;
    }
  }
});

d.update();
