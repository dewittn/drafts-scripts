/**
 * LanguageModel Unit Tests
 *
 * Stubs ModelSession and AnthropicAI to check provider selection, the
 * settings each provider passes on, and how failures come back. The real
 * models only run inside Drafts.
 */

require("../Tests/fixtures/assertions.js");
require("shared/libraries/LanguageModel.js");

const test = new TestAssertions("LanguageModel");

// --- ModelSession stub: records the last session, answers with `reply` ---
let sessions = [];
let sessionReply = "Two wins last week.";
let sessionAvailable = true;
/** @type {any} */ (globalThis).ModelSession = {
  create(mode) {
    const session = {
      mode,
      instructions: [],
      toolSets: ["drafts", "editor"],
      isAvailable: sessionAvailable,
      lastError: undefined,
      prompts: [],
      addInstruction(instruction) {
        this.instructions.push(instruction);
      },
      respond(prompt) {
        this.prompts.push(prompt);
        if (sessionReply == undefined) this.lastError = "The model refused.";
        return sessionReply;
      },
    };
    sessions.push(session);
    return session;
  },
};

// --- AnthropicAI stub: request() answers with `anthropicResponse` ---
let anthropicCalls = [];
const reply = (content, stop_reason = "end_turn") => ({ success: true, statusCode: 200, responseData: { content, stop_reason } });
/** @type {any} */
let anthropicResponse = reply([{ type: "text", text: "  A great week.  " }]);
/** @type {any} */ (globalThis).AnthropicAI = class {
  request(settings) {
    anthropicCalls.push(settings);
    return anthropicResponse;
  }
};

// --- create ---
test.section("create");

test.assertThrows(() => LanguageModel.create({ provider: "nope" }), "an unknown provider throws");
test.assertThrows(() => LanguageModel.create(), "no provider throws");
test.assert(LanguageModel.create({ provider: "apple" }) instanceof AppleLanguageModel, "apple gives the Apple model");
test.assert(LanguageModel.create({ provider: "anthropic" }) instanceof AnthropicLanguageModel, "anthropic gives the Anthropic model");

// --- apple ---
test.section("apple");

const apple = LanguageModel.create({ provider: "apple", mode: "pcc", instructions: ["Be brief."], temperature: 0.4 });
test.assertEqual(apple.respond("Sum up the week."), "Two wins last week.", "returns the response");
const session = sessions[sessions.length - 1];
test.assertEqual(session.mode, "pcc", "uses the mode from settings");
test.assertDeepEqual(session.toolSets, [], "turns Drafts' tools off");
test.assertDeepEqual(session.instructions, ["Be brief."], "adds the instructions");
test.assertEqual(session.temperature, 0.4, "sets the temperature");
test.assertEqual(LanguageModel.create({ provider: "apple" }).mode, "onDevice", "mode defaults to onDevice");

sessionReply = undefined;
const refused = LanguageModel.create({ provider: "apple", mode: "pcc" });
test.assertEqual(refused.respond("Sum up the week."), undefined, "a failed response is undefined");
test.assertEqual(refused.lastError, "The model refused.", "and lastError is the session's error");

sessionReply = "Fine.";
sessionAvailable = false;
const unavailable = LanguageModel.create({ provider: "apple", mode: "pcc" });
test.assertEqual(unavailable.respond("Hi"), undefined, "an unavailable mode is undefined");
test.assertEqual(unavailable.lastError, "The pcc model is not available on this device.", "and says which mode");
sessionAvailable = true;

// --- anthropic ---
test.section("anthropic");

const anthropic = LanguageModel.create({ provider: "anthropic", model: "claude-haiku-5-5", instructions: ["Be brief.", "No emoji."] });
test.assertEqual(anthropic.respond("Sum up the week."), "A great week.", "returns the reply's text, trimmed");
test.assertDeepEqual(
  anthropicCalls[anthropicCalls.length - 1],
  {
    path: "/messages",
    method: "POST",
    data: {
      model: "claude-haiku-5-5",
      max_tokens: 4096,
      system: "Be brief.\nNo emoji.",
      messages: [{ role: "user", content: "Sum up the week." }],
    },
  },
  "posts to /messages with model, max_tokens, the instructions as the system prompt, and the prompt",
);
test.assertDeepEqual(
  LanguageModel.create({ provider: "anthropic", model: "m", maxTokens: 50, temperature: 0.2 }).options,
  { model: "m", max_tokens: 50, temperature: 0.2 },
  "maxTokens and temperature come from settings; no system prompt without instructions",
);
test.assertDeepEqual(
  LanguageModel.create({ provider: "anthropic", model: "m", thinking: false }).options,
  { model: "m", max_tokens: 4096, thinking: { type: "disabled" } },
  "thinking: false turns thinking off",
);

anthropicResponse = reply([{ type: "thinking", thinking: "" }, { type: "text", text: "Two wins. " }, { type: "text", text: "One to go." }]);
test.assertEqual(anthropic.respond("Hi"), "Two wins. One to go.", "skips a thinking block and joins the text blocks");

anthropicResponse = reply([{ type: "thinking", thinking: "" }, { type: "text", text: "This week we" }], "max_tokens");
const cutOff = LanguageModel.create({ provider: "anthropic", model: "m" });
test.assertEqual(cutOff.respond("Hi"), undefined, "a reply cut off at max_tokens is undefined");
test.assertEqual(cutOff.lastError, "The reply was cut off at 4096 tokens. Raise maxTokens.", "and says to raise maxTokens");

anthropicResponse = reply([{ type: "thinking", thinking: "" }]);
const empty = LanguageModel.create({ provider: "anthropic", model: "m" });
test.assertEqual(empty.respond("Hi"), undefined, "a reply with no text is undefined");
test.assertEqual(empty.lastError, "The reply had no text.", "and says so");

anthropicResponse = { success: false, statusCode: 401, responseData: { error: { message: "invalid x-api-key" } } };
const badKey = LanguageModel.create({ provider: "anthropic", model: "m" });
test.assertEqual(badKey.respond("Hi"), undefined, "a failed request is undefined");
test.assertEqual(badKey.lastError, "Anthropic: invalid x-api-key", "and lastError is the API's message");

anthropicResponse = { success: false, statusCode: 503, responseData: undefined };
const down = LanguageModel.create({ provider: "anthropic", model: "m" });
down.respond("Hi");
test.assertEqual(down.lastError, "Anthropic request failed (HTTP 503).", "without an API message, lastError gives the status");

const noModel = LanguageModel.create({ provider: "anthropic" });
test.assertEqual(noModel.respond("Hi"), undefined, "no model is undefined");
test.assertEqual(noModel.lastError, "Set a model for the anthropic provider.", "and says to set one");

test.summary();
