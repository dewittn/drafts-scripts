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

  // Check if already initialized AND has required services
  if (container.has('servicesInitialized') && container.has('cpDefault')) {
    console.log('[ServiceInitializer] Services already initialized, skipping');
    return;
  }

  // If servicesInitialized but missing cpDefault, reset and re-initialize
  if (container.has('servicesInitialized') && !container.has('cpDefault')) {
    console.log('[ServiceInitializer] Services incomplete, resetting...');
    container.reset();
  }

  console.log('[ServiceInitializer] Initializing all services...');

  // Initialize BVR and CP services
  setupBVRServices();
  setupContentPipelineServices();

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
