/**
 * ServiceFactories - Factory functions for common services
 *
 * This module provides factory functions that register all common services
 * with the ServiceContainer. Import and call setupServices() to initialize.
 */

if (typeof ServiceContainer == "undefined") require("core/ServiceContainer.js");

/**
 * Setup all common services in the container
 * This should be called once at application startup
 */
function setupBVRServices() {
  const container = ServiceContainer.getInstance();

  // Core Settings - loaded first as many services depend on it
  container.register('bvrSettings', (c) => {
    if (typeof Settings == "undefined") require("libraries/Settings.js");
    return new Settings("bvr/settings.yaml");
  }, true);

  // UI Service - depends on settings
  container.register('bvrUI', (c) => {
    if (typeof DraftsUI == "undefined") require("shared/core/DraftsUI.js");
    const settings = c.get('bvrSettings');
    return new DraftsUI(settings.ui);
  }, true);

  // BVR Service - depends on settings and UI
  container.register('bvr', (c) => {
    if (typeof BVR == "undefined") require("bvr/BVR.js");
    // BVR will use container internally
    return new BVR();
  }, true);

  // Team Service - factory function that takes teamID
  container.register('teamFactory', (c) => {
    if (typeof Team == "undefined") require("bvr/Team.js");
    return (teamID = "") => new Team(teamID);
  }, true);

  // Sport Service - factory function
  container.register('sportFactory', (c) => {
    if (typeof Sport == "undefined") require("bvr/Sport.js");
    return (sportType) => new Sport(sportType);
  }, true);

  // DataFile factory
  container.register('dataFileFactory', (c) => {
    if (typeof DataFile == "undefined") require("libraries/DataFile.js");
    return (filePath) => new DataFile(filePath);
  }, true);

  // Template factory
  container.register('templateFactory', (c) => {
    if (typeof Template == "undefined") require("cp/templates/Template.js");
    return (settings) => new Template(settings);
  }, true);

  // Settings factory
  container.register('settingsFactory', (c) => {
    if (typeof Settings == "undefined") require("libraries/Settings.js");
    return (filePath) => new Settings(filePath);
  }, true);
}

/**
 * Setup Content Pipeline services
 */
function setupContentPipelineServices() {
  const container = ServiceContainer.getInstance();

  // CP Settings
  container.register('cpSettings', (c) => {
    if (typeof Settings == "undefined") require("libraries/Settings.js");
    return new Settings("cp/settings.yaml");
  }, true);

  // File System
  container.register('cpFileSystem', (c) => {
    if (typeof CloudFS == "undefined") require("cp/filesystems/CloudFS.js");
    return new CloudFS("/Library/Data/cp/");
  }, true);

  // UI for CP
  container.register('cpUI', (c) => {
    if (typeof DraftsUI == "undefined") require("shared/core/DraftsUI.js");
    const settings = c.get('cpSettings');
    return new DraftsUI(settings.ui);
  }, true);

  // Text Utilities
  container.register('textUtilities', (c) => {
    if (typeof TextUtilities == "undefined") require("cp/TextUtilities.js");
    return new TextUtilities();
  }, true);

  // Dependency Provider - provides lazy access to all CP dependencies
  container.register('cpDependencyProvider', (c) => {
    if (typeof SimpleDependencyProvider == "undefined") require("core/SimpleDependencyProvider.js");

    return new SimpleDependencyProvider({
      ui: () => c.get('cpUI'),
      fileSystem: () => c.get('cpFileSystem'),
      settings: () => c.get('cpSettings'),
      textUltilities: () => c.get('textUtilities'),
      tableName: "Content",
      defaultTag: () => c.get('cpSettings').defaultTag["Content"],
      statuses: () => c.get('cpStatuses'),
      destinations: () => c.get('cpDestinations'),
      recentRecords: () => c.get('cpRecentRecords'),
      database: () => c.get('cpDatabase'),
    });
  }, true);

  // Statuses - depends on dependency provider
  container.register('cpStatuses', (c) => {
    if (typeof Statuses == "undefined") require("cp/Statuses.js");
    return new Statuses(c.get('cpDependencyProvider'));
  }, true);

  // Destinations - depends on dependency provider
  container.register('cpDestinations', (c) => {
    if (typeof Destinations == "undefined") require("cp/Destinations.js");
    return new Destinations(c.get('cpDependencyProvider'));
  }, true);

  // Recent Records
  container.register('cpRecentRecords', (c) => {
    if (typeof RecentRecords == "undefined") require("cp/RecentRecords.js");
    return new RecentRecords(c.get('cpDependencyProvider'));
  }, true);

  // Database
  container.register('cpDatabase', (c) => {
    if (typeof NocoController == "undefined") require("cp/databases/NocoDB.js");
    return new NocoController(c.get('cpDependencyProvider'));
  }, true);

  // Document Factory
  container.register('cpDocumentFactory', (c) => {
    if (typeof DocumentFactory == "undefined") require("cp/documents/document_factory.js");
    return new DocumentFactory(c.get('cpDependencyProvider'));
  }, true);
}

/**
 * Initialize all services
 */
function initializeServices() {
  setupBVRServices();
  setupContentPipelineServices();
}