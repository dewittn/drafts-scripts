# Action System Documentation

## Overview

The Action System is a flexible trigger-action framework that replaces the rigid document conversion logic in the Content Pipeline. It allows you to define multiple triggers and actions for each destination through declarative YAML configuration.

## Key Features

- **Multiple Triggers per Destination**: Define multiple trigger-action pairs for each destination
- **Multiple Trigger Types**: Support for status changes, time-based triggers, field changes, etc.
- **Multiple Actions per Trigger**: Execute a sequence of actions when a trigger fires
- **Action History**: Complete audit trail of all action executions with timestamps and results
- **Template Variables**: Use `{{variable}}` syntax to interpolate document properties in action params
- **Extensible**: Easy to add custom action handlers via the ActionRegistry
- **Backward Compatible**: Legacy destinations continue to work during migration

## Architecture

### Core Classes

#### ActionSystem
The orchestrator that manages the entire action lifecycle:
- Loads configuration from `actions.yaml`
- Evaluates triggers against document state
- Executes matching actions in sequence
- Records execution history
- Manages the ActionRegistry

**Location**: `Library/Scripts/cp/actions/ActionSystem.js`

#### ActionRegistry
Registry of action handlers:
- Maps action type strings to handler instances
- Validates handlers have required `execute()` method
- Provides handler lookup

**Location**: `Library/Scripts/cp/actions/ActionRegistry.js`

#### TriggerEvaluator
Evaluates whether trigger conditions match:
- Supports operators: equals, not_equals, matches (regex), older_than, contains
- Accesses document and context properties
- Handles time delta parsing (e.g., "30d", "2w", "1h")

**Location**: `Library/Scripts/cp/actions/TriggerEvaluator.js`

#### ActionHistory
Persists action execution history:
- Records to `action_history.yaml`
- Provides query interface with filters
- Limits history to 1000 entries (configurable)

**Location**: `Library/Scripts/cp/actions/ActionHistory.js`

### Action Handlers

All handlers implement the interface:
```javascript
class SomeAction {
  async execute(doc, params, context) {
    // Perform action
    return { success: true, /* additional data */ };
  }
}
```

#### ConvertDocumentAction
Converts documents between types (Draft ↔ Sheet ↔ Note).

**Params**:
- `targetType` (required): "draft", "sheet", or "note"

**Location**: `Library/Scripts/cp/actions/handlers/ConvertDocumentAction.js`

#### NotificationAction
Displays notifications to the user via the UI system.

**Params**:
- `title` (required): Notification title
- `message` (required): Notification message
- `level` (optional): "info", "success", "warning", or "error" (default: "info")

**Location**: `Library/Scripts/cp/actions/handlers/NotificationAction.js`

#### WebhookAction
Calls external HTTP endpoints.

**Params**:
- `url` (required): Webhook URL
- `method` (optional): HTTP method (default: "POST")
- `body` (optional): Request body object
- `headers` (optional): Additional headers object

**Location**: `Library/Scripts/cp/actions/handlers/WebhookAction.js`

#### LogAction
Logs messages to console.

**Params**:
- `message` (required): Log message
- `level` (optional): Log level (default: "info")

**Location**: `Library/Scripts/cp/actions/handlers/LogAction.js`

#### ArchiveDocumentAction
Archives documents to specified location.

**Params**:
- `location` (required): Archive destination

**Location**: `Library/Scripts/cp/actions/handlers/ArchiveDocumentAction.js`

## Configuration

### actions.yaml Structure

```yaml
Content:  # Table name
  nr.com:  # Destination name
    triggers:
      - id: "convert-on-writing"
        type: "status_change"
        condition:
          field: "status"
          operator: "equals"
          value: "writing"
        actions:
          - type: "convert_document"
            params:
              targetType: "sheet"
          - type: "log"
            params:
              message: "Document converted to sheet"

      - id: "notify-on-published"
        type: "status_change"
        condition:
          field: "status"
          operator: "matches"
          value: "Published.*"
        actions:
          - type: "notification"
            params:
              title: "Content Published"
              message: "{{title}} has been published"
```

### Trigger Types

- `status_change`: Triggered when document status changes
- `time_based`: Triggered based on time conditions (future enhancement)
- `field_change`: Triggered when any field changes (future enhancement)
- `manual`: Manually invoked triggers (future enhancement)

### Condition Operators

- `equals`: Case-insensitive string equality
- `not_equals`: Case-insensitive string inequality
- `matches`: Regular expression match
- `contains`: Substring match
- `older_than`: Time delta comparison (e.g., "30d", "2w", "1h")

### Template Variables

Use `{{variable}}` syntax in action params to interpolate document properties:

```yaml
actions:
  - type: "webhook"
    params:
      url: "https://api.example.com/notify"
      body:
        docID: "{{docID}}"
        title: "{{title}}"
        status: "{{status}}"
```

Available variables include all document properties plus context properties passed to `evaluateTriggers()`.

## Usage

### Basic Usage (Automatic)

The action system is automatically invoked when status changes occur:

```javascript
// In ContentPipeline
await cp.updateStatusOfDoc(draftUUID, "DraftsID");
// ActionSystem automatically evaluates triggers and executes actions
```

### Manual Trigger Invocation

Execute triggers programmatically:

```javascript
const results = await cp.actionSystem.evaluateTriggers(
  doc,
  'status_change',
  { oldStatus: 'drafting', newStatus: 'writing' }
);
```

### Query Action History

```javascript
// Get all conversions for a document
const history = cp.actionSystem.getHistory({
  docID: 'ABC123',
  actionType: 'convert_document'
});

// Get recent failures
const failures = cp.actionSystem.getHistory({
  result: 'failure',
  limit: 10
});

// Get history since a date
const recent = cp.actionSystem.getHistory({
  since: '2025-09-01T00:00:00Z',
  destination: 'nr.com'
});
```

### Register Custom Actions

```javascript
class CustomEmailAction {
  async execute(doc, params, context) {
    const { recipient, subject, body } = params;
    // Send email logic
    return { success: true, emailSent: true };
  }
}

cp.actionSystem.registerAction('send_email', new CustomEmailAction());
```

## Migration

### Migration Utility

Use the migration utility to convert existing destinations:

```javascript
require("cp/migrations/migrate_to_actions.js");

const migrator = new DestinationMigrator();

// Preview what will be migrated
migrator.preview();

// Perform migration
migrator.migrate();
```

The migrator:
1. Reads `destinations.yaml`
2. Converts `statusWhenToConvert` + `convertTo` to trigger-action pairs
3. Writes new `actions.yaml` with all conversions

### Migration Steps

1. **Backup**: Backup `destinations.yaml` before migrating
2. **Preview**: Run `migrator.preview()` to see what will be migrated
3. **Migrate**: Run `migrator.migrate()` to create `actions.yaml`
4. **Review**: Review generated `actions.yaml` and adjust as needed
5. **Enable**: Set `actionsEnabled: true` in `destinations.yaml` for destinations to migrate
6. **Test**: Test with a single destination before enabling all

### Backward Compatibility

During migration, both systems work in parallel:

- If destination has actions configured in `actions.yaml`, use action system
- If no actions configured, fall back to legacy `lookupDocConvertionData()`
- No breaking changes to existing workflows

## Examples

### Example 1: Convert on Status Change

```yaml
inbox:
  triggers:
    - id: "convert-on-writing"
      type: "status_change"
      condition:
        field: "status"
        value: "writing"
      actions:
        - type: "convert_document"
          params:
            targetType: "sheet"
```

### Example 2: Multiple Actions

```yaml
nr.com:
  triggers:
    - id: "convert-and-notify"
      type: "status_change"
      condition:
        field: "status"
        value: "writing"
      actions:
        - type: "convert_document"
          params:
            targetType: "sheet"
        - type: "notification"
          params:
            title: "Conversion Complete"
            message: "{{title}} converted to sheet"
        - type: "log"
          params:
            message: "Converted {{docID}} to sheet"
```

### Example 3: Conditional Webhook

```yaml
"author update":
  triggers:
    - id: "webhook-on-published"
      type: "status_change"
      condition:
        field: "status"
        operator: "matches"
        value: "Published.*"
      actions:
        - type: "webhook"
          params:
            url: "https://api.example.com/published"
            method: "POST"
            body:
              docID: "{{docID}}"
              title: "{{title}}"
              publishedStatus: "{{status}}"
```

### Example 4: Archive Old Documents

```yaml
portfolio:
  triggers:
    - id: "archive-old-drafts"
      type: "time_based"
      condition:
        field: "lastModified"
        operator: "older_than"
        value: "30d"
      actions:
        - type: "archive_document"
          params:
            location: "archived"
```

## Troubleshooting

### Actions Not Executing

1. Check that `actions.yaml` exists and is valid YAML
2. Verify destination name matches exactly (case-sensitive)
3. Check trigger condition matches document state
4. Review console logs for error messages

### Action Failures

1. Check action history: `cp.actionSystem.getHistory({ result: 'failure' })`
2. Review error messages in history entries
3. Verify all required params are provided
4. Check handler implementation for bugs

### Legacy Conversion Not Working

The system falls back to legacy conversion if:
- No actions configured for destination
- `hasActionsForDestination()` returns false

Verify `actions.yaml` has triggers defined for the destination.

## Future Enhancements

- **Time-based Triggers**: Scheduled actions based on time
- **Field Change Triggers**: React to any field modification
- **Manual Triggers**: User-invoked actions from UI
- **Conditional Actions**: If/else logic in action sequences
- **Action Rollback**: Undo actions on failure
- **Retry Logic**: Automatic retry for failed async actions
- **Action Chaining**: Pass output from one action to next
- **Validation**: Schema validation for action configs

## Configuration Files

- `Library/Data/cp/actions.yaml` - Action definitions
- `Library/Data/cp/action_history.yaml` - Execution history
- `Library/Data/cp/settings.yaml` - Action system settings
- `Library/Data/cp/destinations.yaml` - Destination configs (backward compat)

## API Reference

### ActionSystem

```javascript
// Evaluate triggers for a document
await actionSystem.evaluateTriggers(doc, triggerType, context)

// Register custom action handler
actionSystem.registerAction(actionType, handler)

// Query action history
actionSystem.getHistory(filters)

// Check if destination has actions
actionSystem.hasActionsForDestination(destination)
```

### ActionHistory

```javascript
// Query with filters
history.query({
  docID: 'ABC123',
  destination: 'nr.com',
  triggerType: 'status_change',
  actionType: 'convert_document',
  result: 'success',
  since: '2025-01-01T00:00:00Z',
  limit: 50
})

// Clear history
history.clear()
```

### TriggerEvaluator

```javascript
// Evaluate trigger condition
evaluator.evaluate(trigger, doc, context)
```

## Support

For issues, questions, or feature requests, consult:
- This README
- Source code comments
- `migrate_to_actions.js` for migration examples
- Action handler implementations for custom action patterns