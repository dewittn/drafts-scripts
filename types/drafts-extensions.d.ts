/// <reference path="drafts.d.ts" />
// The reference above makes drafts.d.ts load first. Merged interface overloads
// declared later take priority, so the overrides below win over upstream.
//
// Globals Drafts provides at runtime that types/drafts.d.ts does not declare.
// Project classes are NOT declared here: the checker reads them from source.

/**
 * Drafts' JavaScriptCore context exposes a console that writes to the action
 * log. tsconfig.json leaves out the DOM lib (Drafts has no DOM), which is where
 * TypeScript normally gets `console`.
 */
interface Console {
  log(...data: any[]): void;
  info(...data: any[]): void;
  warn(...data: any[]): void;
  error(...data: any[]): void;
  debug(...data: any[]): void;
}
declare var console: Console;

/**
 * Upstream declares the message as required, but its own doc comment says
 * "If a message is included", and the scripts call both with no argument.
 */
interface Context {
  cancel(message?: string): void;
  fail(message?: string): void;
}

/**
 * Upstream returns `object | undefined`, which forbids reading any property of
 * the parsed JSON. The shape depends on the file, so return `any`.
 */
interface FileManager {
  readJSON(path: string): any;
}

/**
 * Methods Library/Scripts/vendor/nr.js adds to Draft.prototype. TypeScript does
 * not pick up prototype assignments on an ambient class, so they are declared
 * here. They exist at runtime only after `require("vendor/nr.js")`.
 */
interface Draft {
  insertTemplate(templateName?: string): void;
  activate(actionGroup?: string, workspaceName?: string): void;
  archive(): void;
  trash(): void;
}

/**
 * Upstream declares createWithTemplate and createWithPath as instance methods,
 * but its own example calls `MustacheTemplate.createWithTemplate(t)`. They are
 * factories, so declare them as statics by merging a namespace into the class.
 */
declare namespace MustacheTemplate {
  function createWithTemplate(template: string): MustacheTemplate;
  function createWithPath(path: string): MustacheTemplate;
}
