// Audible to AirTable Automation
require("nr.js");

function getAubidleURL() {
  const url = "https://www.audible.com/pd/Such-Big-Dreams-Audiobook/B09LRLD7L1";
  return encodeURIComponent(url);
}

function getCSSSelectors() {
  const bookImage = "#center-1 img.bc-pub-block.bc-image-inset-border.js-only-element";
  const bookDescription = "#center-8 div.bc-box.bc-box-padding-none.bc-spacing-s2";
  const selectors = [bookImage, bookDescription];

  return encodeURIComponent(selectors.join(", "));
}

function getAudibleData(file) {
  if (file != undefined) return parseJSONFromiCloudFile(file);

  const http = HTTP.create(),
    audibleURL = getAubidleURL(),
    cssSelector = getCSSSelectors(),
    render = "true",
    requestURL = "https://api.apilayer.com/adv_scraper/scraper",
    params = { url: audibleURL, selector: cssSelector, render: render };

  console.log(JSON.stringify(params));
  const response = http.request({
    method: "GET",
    url: requestURL,
    parameters: params,
    headers: {
      apikey: getAPIKey(),
    },
  });

  if (response.success) return JSON.parse(response.responseData);

  displayMessage(`Error ${response.statusCode}`, response.responseData?.message);
  console.log(response.statusCode);
  console.log(JSON.stringify(response.responseData));
  context.cancel();
}

function getAPIKey() {
  const credential = Credential.create("APILayer", "API Key for .");

  credential.addTextField("apiKey", "Please enter your APILayer Key:");
  credential.authorize();

  return credential.getValue("apiKey");
}

// const testData = getAudibleData("aubidle-testData-1.json");
const testData = getAudibleData();
text = JSON.stringify(testData);

//
// const data = testData["data-selector"];
//
// const { page_title } = testData;
//
// const httpRegex =
//   /(http|ftp|https):\/\/([\w\-_]+(?:(?:\.[\w\-_]+)+))([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/;
//
// const url = data[0].match(httpRegex)[0];
//
// const text = data[2].match(/<p>(?:[^<]|<(?!\/p>))*<\/p>/g).map(function (val) {
//   return val.replace(/<[^>]+>/g, "").replace(/\s\s+/g, " ");
// });

draft.content = text;
