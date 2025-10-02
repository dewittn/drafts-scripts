require("shared/libraries/kutt.js");
// Usage Example:
(async () => {
  const kuttItApi = new KuttItAPI();

  try {
    console.log("Health Check:", await kuttItApi.getHealth());
    console.log("Links:", await kuttItApi.getLinks(10, 0, false));
    // console.log(
    //   "Create Link:",
    //   await kuttItApi.createLink("https://example.com", "Example link")
    // );
    // ... other methods
  } catch (error) {
    console.error("Error:", error);
  }
  script.complete();
})();
