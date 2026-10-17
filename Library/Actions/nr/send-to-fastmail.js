require("vendor/nr.js");
require("shared/libraries/fastmail.js");
require("shared/libraries/DraftsUI.js");
require("modules/nr/EmailDraft.js");

// Creates a Fastmail draft from the current draft. Fails the action on error
// so later steps (like trashing the draft) do not run.
function sendToFastmail() {
  const settings = loadSettings("nr-settings.json");
  const email = new EmailDraft(draft.content);
  const signature = settings.fastmail?.signature;
  if (signature && askToAttachSignature()) email.addSignature(signature);

  if (!promptForMissingFields(email)) return context.cancel("Missing email fields");

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

function askToAttachSignature() {
  const answer = new DraftsUI().yesNoPrompt({
    menuTitle: "Send to Fastmail",
    menuMessage: "Attach your signature?",
  });
  return answer == "yes";
}

// Asks for whichever of the subject and recipient the draft is missing.
// Leaving a field blank creates the draft without it. Returns false on cancel.
function promptForMissingFields(email, error = "") {
  const needsSubject = email.subject == "";
  const needsRecipient = email.recipients.length == 0;
  if (!needsSubject && !needsRecipient) return true;

  const missing = [needsSubject && "Subject:", needsRecipient && "Email:"].filter(Boolean).join(" or ");
  const prompt = Prompt.create();
  prompt.title = "Send to Fastmail";
  prompt.message = error || `No ${missing} line found.`;
  if (needsSubject) prompt.addTextField("subject", "Subject", "");
  if (needsRecipient) {
    prompt.addTextField("to", "To", email.to);
    prompt.addTextField("email", "Email Address", "", {
      keyboard: "emailAddress",
      autocapitalization: "none",
      autocorrect: false,
    });
  }
  prompt.addButton("Create Draft");
  if (!prompt.show()) return false;

  const { subject = "", to = "", email: address = "" } = prompt.fieldValues;
  if (needsSubject) email.subject = subject.trim();
  if (needsRecipient) {
    email.recipients = EmailDraft.parseRecipients(to.trim(), address.trim());
    if (address.trim() != "" && email.recipients.length == 0) {
      return promptForMissingFields(email, `"${address.trim()}" is not a valid email address.`);
    }
  }
  return true;
}

sendToFastmail();
