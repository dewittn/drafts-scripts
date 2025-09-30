// ActionHistory.js
// Tracks and persists action execution history

class ActionHistory {
  #fs;
  #historyFile;
  #history;
  #maxEntries;

  constructor(dependancies) {
    this.#fs = dependancies.fileSystem;
    this.#historyFile = "cp/action_history.yaml";
    this.#maxEntries = 1000;

    this.#load();
  }

  #load() {
    try {
      const data = this.#fs.read(this.#historyFile);
      this.#history = data?.history || [];
    } catch (error) {
      console.warn("Could not load action history, starting fresh");
      this.#history = [];
    }
  }

  #save() {
    // Trim history if too large
    if (this.#history.length > this.#maxEntries) {
      this.#history = this.#history.slice(-this.#maxEntries);
    }

    this.#fs.write(this.#historyFile, { history: this.#history });
  }

  // Record an action execution
  record({ doc, trigger, action, result, details = null, error = null }) {
    const entry = {
      timestamp: new Date().toISOString(),
      docID: doc.docID,
      docIDType: doc.docIDType,
      destination: doc.destination,
      triggerID: trigger.id,
      triggerType: trigger.type,
      action: {
        type: action.type,
        params: action.params,
      },
      result,
      ...(details && { details }),
      ...(error && { error }),
    };

    this.#history.push(entry);
    this.#save();
  }

  // Query history with filters
  query(filters = {}) {
    let results = this.#history;

    if (filters.docID) {
      results = results.filter((e) => e.docID === filters.docID);
    }

    if (filters.destination) {
      results = results.filter((e) => e.destination === filters.destination);
    }

    if (filters.triggerType) {
      results = results.filter((e) => e.triggerType === filters.triggerType);
    }

    if (filters.actionType) {
      results = results.filter((e) => e.action.type === filters.actionType);
    }

    if (filters.result) {
      results = results.filter((e) => e.result === filters.result);
    }

    if (filters.since) {
      const since = new Date(filters.since);
      results = results.filter((e) => new Date(e.timestamp) >= since);
    }

    if (filters.limit) {
      results = results.slice(-filters.limit);
    }

    return results;
  }

  // Clear history
  clear() {
    this.#history = [];
    this.#save();
  }
}