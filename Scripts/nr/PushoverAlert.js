class PushoverAlert {
  static apiURL = "https://api.pushover.net/1/messages.json";
  #params = {};

  constructor() {
    this.#authorize();
  }

  get apiURL() {
    return this.constructor.apiURL;
  }

  set message(text) {
    this.#params["message"] = text;
  }

  set title(text) {
    this.#params["title"] = text;
  }

  set url(text) {
    this.#params["url"] = text;
  }

  set urlTitle(text) {
    this.#params["url_title"] = text;
  }

  set priority(value) {
    this.#params["priority"] = value;
  }

  send() {
    if (this.#params?.message == undefined) return false;

    const http = HTTP.create();
    const response = http.request({
      url: this.apiURL,
      parameters: this.#params,
      method: "POST",
    });

    if (response.success) return true;

    app.displayErrorMessage("Sending Pushover message failed!");
    console.log(JSON.stringify(response));
    return false;
  }

  #authorize() {
    const credential = Credential.create("Pushover", "Pushover API token and user key.");
    credential.addPasswordField("apiKey", "API Key");
    credential.addPasswordField("userKey", "User Key");
    credential.authorize();

    this.#params["token"] = credential.getValue("apiKey");
    this.#params["user"] = credential.getValue("userKey");
  }
}
