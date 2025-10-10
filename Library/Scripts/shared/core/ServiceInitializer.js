/**
 * ServiceInitializer - Global service initialization
 *
 * This module initializes all services in the ServiceContainer.
 * Call initializeServices() once at the start of each action.
 *
 * The function is idempotent - safe to call multiple times.
 * Services are only registered once.
 */

if (typeof ServiceContainer == "undefined") {
  require("shared/core/ServiceContainer.js");
}
if (typeof setupBVRServices == "undefined") {
  require("shared/core/ServiceFactories.js");
}

/**
 * Initialize all services in the ServiceContainer
 * Safe to call multiple times - services only registered once
 */
function initializeServices() {
  const container = ServiceContainer.getInstance();

  // Check if already initialized
  if (container.has('servicesInitialized')) {
    console.log('[ServiceInitializer] Services already initialized, skipping');
    return;
  }

  console.log('[ServiceInitializer] Initializing all services...');

  // Initialize BVR and CP services
  setupBVRServices();
  setupContentPipelineServices();

  // Register ContentPipeline as a factory that returns singletons per table
  container.register('contentPipeline', (c) => {
    if (typeof ContentPipeline == "undefined") {
      require("modules/cp/core/ContentPipeline.js");
    }
    // Return factory function that creates/returns singleton per table
    return (table = "Content") => ContentPipeline.getInstance(table);
  }, true);

  // Register default ContentPipeline instance for convenience
  container.register('cpDefault', (c) => {
    if (typeof ContentPipeline == "undefined") {
      require("modules/cp/core/ContentPipeline.js");
    }
    return ContentPipeline.getInstance("Content");
  }, true);

  // Mark as initialized
  container.register('servicesInitialized', () => true, true);

  console.log('[ServiceInitializer] Services initialized successfully');
  console.log(`[ServiceInitializer] Registered services: ${container.getRegisteredServices().length}`);
}

/**
 * Reset all services (useful for testing)
 */
function resetServices() {
  const container = ServiceContainer.getInstance();
  container.reset();
  console.log('[ServiceInitializer] All services reset');
}
