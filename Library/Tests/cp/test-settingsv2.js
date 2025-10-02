// Test script for SettingsV2 with Map and Proxy implementation

// Load the CloudFS module
require("modules/cp/filesystems/CloudFS.js");

// Test with nr-settings.yaml
const settings = new SettingsV2("nr-settings.yaml", "meats");

// Test property access through Proxy
console.log("Property access test:");
console.log("actionGroup:", settings.actionGroup);
console.log("meatsTemplate:", settings.meatsTemplate);
console.log("thingsListName:", settings.thingsListName);

// Test load() method
console.log("\nload() method test:");
console.log("load('actionGroup'):", settings.load("actionGroup"));
console.log("load('defaultTags'):", settings.load("defaultTags"));
console.log("load('taskChoices'):", settings.load("taskChoices"));

// Test setting new values
console.log("\nSetting new values test:");
settings.newProperty = "test value";
console.log("newProperty via proxy:", settings.newProperty);
console.log("newProperty via load():", settings.load("newProperty"));

// Test that load() returns undefined for non-existent keys
console.log("\nNon-existent key test:");
console.log("load('nonExistent'):", settings.load("nonExistent"));