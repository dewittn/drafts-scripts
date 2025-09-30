// LogAction.js
// Action handler for logging messages

class LogAction {
  async execute(doc, params, context) {
    const { message, level = "info" } = params;

    if (!message) {
      throw new Error("message parameter is required for log action");
    }

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    console.log(logMessage);

    return {
      success: true,
      message,
      level,
      timestamp,
    };
  }
}