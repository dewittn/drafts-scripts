// WebhookAction.js
// Action handler for calling external webhooks

class WebhookAction {
  async execute(doc, params, context) {
    const { url, method = "POST", body = {}, headers = {} } = params;

    if (!url) {
      throw new Error("url parameter is required for webhook action");
    }

    // In Drafts environment, use HTTP object
    const http = HTTP.create();

    const requestConfig = {
      url,
      method: method.toUpperCase(),
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    // Only add data for methods that support body
    if (["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      requestConfig.data = body;
    }

    const response = http.request(requestConfig);

    if (response.success) {
      return {
        success: true,
        statusCode: response.statusCode,
        responseBody: response.responseText,
      };
    } else {
      throw new Error(`Webhook failed: ${response.error || "Unknown error"}`);
    }
  }
}