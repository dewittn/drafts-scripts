// Declarations used only by scripts/typecheck.ts.
//
// The checker reads project scripts with two same-length, in-memory rewrites so
// TypeScript treats them as shared-scope scripts instead of CommonJS modules:
//   require(        ->  Require(
//   module.exports  ->  module.Exports
// Nothing here exists at runtime and no source file uses these names directly.

/** Checker alias for the Drafts `require()` declared in drafts.d.ts. */
declare function Require(path: string): void;

/** Undefined in Drafts; four files guard `module.exports` for Node compatibility. */
declare var module: any;
