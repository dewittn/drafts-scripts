// Minimal types for the part of js-yaml 4 that scripts/build.ts uses.
declare module "js-yaml" {
  export function load(input: string): unknown;
  const yaml: { load: typeof load };
  export default yaml;
}
