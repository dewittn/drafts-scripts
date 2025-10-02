require("modules/bvr/messages/system_message.js");
require("modules/bvr/messages/text_message.js");
require("modules/bvr/messages/email_message.js");

function meesageFactory(msgConfig) {
  switch (msgConfig.type.toLowerCase()) {
    case "text":
      return new TextMessage(msgConfig);
      break;
    case "email":
      return new EmailMessage(msgConfig);
      break;
    case "system":
    default:
      return new SystemMessage(msgConfig);
  }
}
