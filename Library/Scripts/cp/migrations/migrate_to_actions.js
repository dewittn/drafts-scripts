// migrate_to_actions.js
// Migration utility to convert legacy destination configurations to action system

require("cp/filesystems/CloudFS.js");

class DestinationMigrator {
  #fs;
  #destinationsFile;
  #actionsFile;

  constructor() {
    this.#fs = new CloudFS("/Library/Data/cp/");
    this.#destinationsFile = "cp/destinations.yaml";
    this.#actionsFile = "cp/actions.yaml";
  }

  // Migrate all destinations to actions.yaml
  migrate() {
    console.log("Starting migration from destinations.yaml to actions.yaml...");

    const destinations = this.#loadDestinations();
    const actions = {
      actionTypes: this.#getDefaultActionTypes(),
    };

    // Migrate each table
    for (const [tableName, dests] of Object.entries(destinations)) {
      console.log(`Migrating table: ${tableName}`);
      actions[tableName] = {};

      for (const [destName, destConfig] of Object.entries(dests)) {
        if (destConfig.statusWhenToConvert && destConfig.convertTo) {
          actions[tableName][destName] = {
            triggers: [
              {
                id: `legacy-convert-${destName.replace(/[^a-z0-9]/gi, "-")}`,
                type: "status_change",
                condition: {
                  field: "status",
                  operator: "equals",
                  value: destConfig.statusWhenToConvert,
                },
                actions: [
                  {
                    type: "convert_document",
                    params: {
                      targetType: destConfig.convertTo,
                    },
                  },
                ],
              },
            ],
          };

          console.log(
            `  - Migrated ${destName}: ${destConfig.statusWhenToConvert} -> ${destConfig.convertTo}`
          );
        }
      }
    }

    // Write new actions.yaml
    this.#fs.write(this.#actionsFile, actions);
    console.log("\nMigration complete! actions.yaml has been created.");
    console.log(
      "Review the file and enable actions by setting actionsEnabled: true in destinations.yaml"
    );

    return actions;
  }

  // Generate a migration report
  generateReport() {
    const destinations = this.#loadDestinations();
    const report = {
      tables: {},
      summary: {
        totalDestinations: 0,
        migratable: 0,
        noConversion: 0,
      },
    };

    for (const [tableName, dests] of Object.entries(destinations)) {
      report.tables[tableName] = {
        destinations: {},
        count: 0,
      };

      for (const [destName, destConfig] of Object.entries(dests)) {
        report.summary.totalDestinations++;
        report.tables[tableName].count++;

        if (destConfig.statusWhenToConvert && destConfig.convertTo) {
          report.summary.migratable++;
          report.tables[tableName].destinations[destName] = {
            migratable: true,
            statusWhenToConvert: destConfig.statusWhenToConvert,
            convertTo: destConfig.convertTo,
          };
        } else {
          report.summary.noConversion++;
          report.tables[tableName].destinations[destName] = {
            migratable: false,
            reason: "No conversion configuration",
          };
        }
      }
    }

    return report;
  }

  // Preview what will be migrated
  preview() {
    const report = this.generateReport();

    console.log("=== MIGRATION PREVIEW ===\n");
    console.log(`Total destinations: ${report.summary.totalDestinations}`);
    console.log(`Migratable: ${report.summary.migratable}`);
    console.log(`No conversion config: ${report.summary.noConversion}\n`);

    for (const [tableName, tableData] of Object.entries(report.tables)) {
      console.log(`\n${tableName}:`);
      for (const [destName, destData] of Object.entries(
        tableData.destinations
      )) {
        if (destData.migratable) {
          console.log(
            `  ✓ ${destName}: ${destData.statusWhenToConvert} -> ${destData.convertTo}`
          );
        } else {
          console.log(`  ✗ ${destName}: ${destData.reason}`);
        }
      }
    }

    console.log("\n=== END PREVIEW ===");

    return report;
  }

  #loadDestinations() {
    try {
      return this.#fs.read(this.#destinationsFile);
    } catch (error) {
      console.error("Error loading destinations.yaml:", error.message);
      throw error;
    }
  }

  #getDefaultActionTypes() {
    return {
      convert_document: {
        description: "Convert document to another type",
        requiredParams: ["targetType"],
        async: false,
      },
      notification: {
        description: "Display notification to user",
        requiredParams: ["title", "message"],
        optionalParams: ["level"],
        async: false,
      },
      webhook: {
        description: "Call external webhook",
        requiredParams: ["url"],
        optionalParams: ["method", "body", "headers"],
        async: true,
      },
      archive_document: {
        description: "Move document to archive",
        requiredParams: ["location"],
        async: false,
      },
      log: {
        description: "Log message to console",
        requiredParams: ["message"],
        optionalParams: ["level"],
        async: false,
      },
    };
  }
}

// Usage:
// const migrator = new DestinationMigrator();
// migrator.preview();  // Preview what will be migrated
// migrator.migrate();  // Perform the migration