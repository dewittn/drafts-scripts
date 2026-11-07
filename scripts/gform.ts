#!/usr/bin/env bun
/**
 * Print a Google Form's questions, so entry IDs can be mapped into
 * Library/Data/bvr/forms.yaml without access to the form editor.
 *
 * Usage:
 *   bun run gform <url-or-file> [--check <form-name>]
 *
 * <url-or-file> is a form link (viewform, formResponse or edit, with or
 * without a query string) or a saved .html copy of the form's page. A form
 * that needs a school sign-in cannot be fetched: open it in a signed-in
 * browser, save the page source, and pass that file.
 *
 * --check <form-name> compares that entry in forms.yaml with the form and
 * exits non-zero when an entry ID is missing or an option is not offered.
 * Run it each season to see whether a school form's IDs or options moved.
 */
import yaml from "js-yaml";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./lib/drafts-paths";
import {
  checkForm,
  extractFormData,
  GFormError,
  isLoginURL,
  loginHelp,
  parseForm,
  settingsFormNamed,
  viewFormURL,
} from "./lib/gform";
import { renderCheck, renderPageHistory, renderQuestions, renderYamlSnippet } from "./lib/gform-report";

const formsFile = join(repoRoot, "Library", "Data", "bvr", "forms.yaml");
const args = process.argv.slice(2);

// The value after --check, or undefined when the flag is absent.
function checkName(): string | undefined {
  const at = args.indexOf("--check");
  if (at == -1) return undefined;
  const value = args[at + 1];
  if (value == undefined || value.startsWith("--")) throw new GFormError("--check needs a form name from forms.yaml");
  return value;
}

// The first argument that is neither a flag nor the --check value.
const input = () => args.find((arg, i) => !arg.startsWith("--") && args[i - 1] != "--check");

// The form's page: fetched when the input is a link, else read from the file.
async function loadHTML(source: string): Promise<string> {
  if (!/^https?:\/\//i.test(source)) {
    if (!existsSync(source)) throw new GFormError(`${source} is not a web link or an existing file`);
    return readFileSync(source, "utf8");
  }
  const url = viewFormURL(source);
  if (url == undefined) throw new GFormError(`${source} is not a web link`);
  const response = await fetch(url);
  if (isLoginURL(response.url)) throw new GFormError(loginHelp);
  if (!response.ok) throw new GFormError(`Fetching ${url} failed: ${response.status} ${response.statusText}`);
  return response.text();
}

async function run() {
  const source = input();
  if (source == undefined) throw new GFormError("Usage: bun run gform <url-or-file> [--check <form-name>]");
  const name = checkName();

  const form = parseForm(extractFormData(await loadHTML(source)));
  console.log(renderQuestions(form));
  console.log(`\n${renderPageHistory(form)}`);
  console.log(`\nforms.yaml snippet (rename the placeholder keys):\n${renderYamlSnippet(form)}`);

  if (name == undefined) return;
  const settings = settingsFormNamed(yaml.load(readFileSync(formsFile, "utf8")), name);
  const result = checkForm(form, settings);
  console.log(`\n${renderCheck(name, result)}`);
  if (result.problems.length > 0) process.exit(1);
}

try {
  await run();
} catch (error) {
  console.error(error instanceof GFormError ? error.message : error);
  process.exit(1);
}
