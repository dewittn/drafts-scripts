require("vendor/nr.js");
require("shared/libraries/fastmail.js");
require("modules/nr/EmailDraft.js");

// Creates a Fastmail draft from the current draft. Fails the action on error
// so later steps (like trashing the draft) do not run.
function sendToFastmail() {
  const settings = loadSettings("nr-settings.json");
  const email = new EmailDraft(draft.content);
  email.addSignature(settings.fastmail?.signature);

  if (email.subject == "") {
    const subject = promptForSubject();
    if (subject == undefined) return context.cancel("No subject entered");
    email.subject = subject;
  }

  const result = new Fastmail().createDraft({
    to: email.recipients,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });

  if (!result.success) return context.fail(result.error);

  const recipient = email.recipients.map((item) => item.name ?? item.email).join(", ");
  app.displaySuccessMessage(`Fastmail draft created${recipient ? ` for ${recipient}` : ""}`);
}

function promptForSubject() {
  const prompt = Prompt.create();
  prompt.title = "Send to Fastmail";
  prompt.message = "No Subject: line found.";
  prompt.addTextField("subject", "Subject", "");
  prompt.addButton("Create Draft");
  if (!prompt.show()) return undefined;
  return prompt.fieldValues.subject.trim();
}

sendToFastmail();
