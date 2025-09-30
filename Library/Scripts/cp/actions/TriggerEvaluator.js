// TriggerEvaluator.js
// Evaluates trigger conditions against document state

class TriggerEvaluator {
  // Evaluate if a trigger condition matches
  evaluate(trigger, doc, context) {
    const condition = trigger.condition;

    if (!condition) return true;

    const value = this.#getFieldValue(condition.field, doc, context);
    const targetValue = condition.value;
    const operator = condition.operator || "equals";

    return this.#evaluateCondition(value, operator, targetValue);
  }

  #getFieldValue(field, doc, context) {
    // Check doc properties first, then context
    return doc[field] ?? context[field];
  }

  #evaluateCondition(value, operator, targetValue) {
    switch (operator) {
      case "equals":
        return value?.toLowerCase() === targetValue?.toLowerCase();

      case "not_equals":
        return value?.toLowerCase() !== targetValue?.toLowerCase();

      case "matches":
        const regex = new RegExp(targetValue, "i");
        return regex.test(value);

      case "older_than":
        return this.#evaluateTimeDelta(value, targetValue);

      case "contains":
        return value?.includes(targetValue);

      default:
        console.warn(`Unknown operator: ${operator}`);
        return false;
    }
  }

  #evaluateTimeDelta(dateValue, deltaString) {
    // Parse "30d", "2w", "1h" format
    const match = deltaString.match(/^(\d+)([dwh])$/);
    if (!match) return false;

    const [, amount, unit] = match;
    const multipliers = { d: 86400000, w: 604800000, h: 3600000 };
    const deltaMs = parseInt(amount) * multipliers[unit];

    const date = new Date(dateValue);
    const now = new Date();

    return now - date > deltaMs;
  }
}