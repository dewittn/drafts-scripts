// NotificationAction.js
// Action handler for displaying notifications to the user

class NotificationAction {
  #ui;

  constructor(dependancies) {
    this.#ui = dependancies.ui;
  }

  async execute(doc, params, context) {
    const { title, message, level = "info" } = params;

    if (!title || !message) {
      throw new Error("title and message parameters are required for notification action");
    }

    // Display notification using UI system
    this.#ui.displayAppMessage(level, title, { message });

    return {
      success: true,
      title,
      message,
      level,
    };
  }
}