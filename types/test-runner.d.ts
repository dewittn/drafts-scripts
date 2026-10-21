// Globals scripts/test-runner.js gives unit tests. Nothing here exists in Drafts.

/**
 * Parse a plain committed YAML file under Library/Data/ (e.g. "bvr/ui.yaml")
 * the way the build's yaml2json does. Refuses a .yaml rendered from a .yaml.tpl.
 */
declare function loadRepoYAML(path: string): any;
