// Prompts a language model through whichever provider the settings name, so
// a script can switch providers by changing settings, not code:
//
//   { provider: "apple", mode: "pcc" }
//       Drafts' ModelSession (iOS/macOS 27, Apple Intelligence). mode is
//       "onDevice", "pcc" (Private Cloud Compute), or another mode
//       ModelSession.availableModes() lists.
//   { provider: "anthropic", model: "claude-haiku-5-5", maxTokens: 4096, thinking: false }
//       Drafts' AnthropicAI. The API key lives in Drafts' credentials; Drafts
//       asks for it the first time. thinking: false turns extended thinking
//       off, for short replies that don't need it.
//
// Both take optional `instructions` (a list of strings) and `temperature`.
// respond(prompt) returns the text, or undefined with lastError set.
class LanguageModel {
  static create(settings = {}) {
    const providers = { apple: AppleLanguageModel, anthropic: AnthropicLanguageModel };
    const Provider = providers[settings.provider];
    if (Provider == undefined) {
      throw new Error(`Unknown language model provider "${settings.provider}" (use apple or anthropic)`);
    }
    return new Provider(settings);
  }
}

// Apple Intelligence through ModelSession, with Drafts' tools turned off:
// these prompts only need text back.
class AppleLanguageModel {
  #settings;
  lastError;

  constructor(settings) {
    this.#settings = settings;
  }

  get mode() {
    return this.#settings.mode || "onDevice";
  }

  respond(prompt) {
    if (typeof ModelSession == "undefined") return this.#fail("ModelSession needs iOS or macOS 27.");

    const session = ModelSession.create(this.mode);
    if (!session.isAvailable) return this.#fail(`The ${this.mode} model is not available on this device.`);

    session.toolSets = [];
    (this.#settings.instructions || []).forEach((instruction) => session.addInstruction(instruction));
    if (this.#settings.temperature != undefined) session.temperature = this.#settings.temperature;

    const response = session.respond(prompt);
    if (!response) return this.#fail(session.lastError);
    return `${response}`.trim();
  }

  #fail(message) {
    this.lastError = message;
    return undefined;
  }
}

// Anthropic's Messages API through Drafts' AnthropicAI. Uses request(), not
// quickPrompt(): newer models such as Haiku 5.5 can open their reply with a
// thinking block, and quickPrompt reads only the first block, so it returns
// nothing. Thinking also counts toward max_tokens, hence the roomy default:
// 1024 cut off a two-sentence reply on 2026-11-06.
class AnthropicLanguageModel {
  #settings;
  lastError;

  constructor(settings) {
    this.#settings = settings;
  }

  // The request body, without the messages.
  get options() {
    const { model, maxTokens = 4096, instructions = [], temperature, thinking } = this.#settings;
    const options = { model, max_tokens: maxTokens };
    if (thinking === false) options.thinking = { type: "disabled" };
    if (instructions.length > 0) options.system = instructions.join("\n");
    if (temperature != undefined) options.temperature = temperature;
    return options;
  }

  respond(prompt) {
    if (!this.#settings.model) return this.#fail("Set a model for the anthropic provider.");

    const ai = new AnthropicAI();
    const data = { ...this.options, messages: [{ role: "user", content: prompt }] };
    const response = ai.request({ path: "/messages", method: "POST", data: /** @type {any} */ (data) });
    if (!response.success) return this.#fail(AnthropicLanguageModel.errorMessage(response));

    const reply = response.responseData || {};
    if (reply.stop_reason == "max_tokens") {
      return this.#fail(`The reply was cut off at ${this.options.max_tokens} tokens. Raise maxTokens.`);
    }

    const text = AnthropicLanguageModel.replyText(reply);
    return text == "" ? this.#fail("The reply had no text.") : text;
  }

  // The reply's text blocks joined, skipping thinking and any other blocks.
  static replyText(reply) {
    const blocks = Array.isArray(reply?.content) ? reply.content : [];
    return blocks
      .filter((block) => block.type == "text")
      .map((block) => block.text)
      .join("")
      .trim();
  }

  // The API's own message when it sent one, else the HTTP status.
  static errorMessage(response) {
    const apiMessage = response.responseData?.error?.message;
    return apiMessage ? `Anthropic: ${apiMessage}` : `Anthropic request failed (HTTP ${response.statusCode}).`;
  }

  #fail(message) {
    this.lastError = message;
    return undefined;
  }
}
