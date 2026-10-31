// Creates a Gmail draft for Send to Gmail. Google Apps Script, not a Drafts
// script: it runs on Google's servers as the account that deployed it. This is
// the tracked copy. Changes must be pasted into the project and redeployed.
//
// Drafts' built-in GmailMessage can only send, and the Gmail API needs a Google
// Cloud app whose sign-in expires weekly until it is verified. Apps Script can
// create a real draft with neither.
//
// To deploy, at script.google.com:
//   1. Create a project and paste this in.
//   2. Project Settings > Script Properties: add SECRET with a long random value.
//   3. Deploy > New deployment > Web app. Execute as: Me. Access: Anyone.
//      Drafts can't sign in to Google, so SECRET is what guards the address.
//   4. Approve the permissions. Google warns that the app is unverified, which
//      is expected for your own script.
//   5. Run Send to Gmail. Drafts asks for the web app URL and the secret once
//      per device.

function doPost(e) {
  const { secret, to, subject, text, html } = JSON.parse(e.postData.contents);
  const saved = PropertiesService.getScriptProperties().getProperty("SECRET");
  if (secret !== saved) return respond({ error: "Not allowed" });

  const draft = GmailApp.createDraft(to, subject, text, { htmlBody: html });
  return respond({ success: true, id: draft.getId() });
}

function respond(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
