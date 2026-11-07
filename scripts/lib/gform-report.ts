/**
 * The text `bun run gform` prints: the questions by page, the direct-submit
 * pageHistory, and a forms.yaml `fields:` snippet. Takes a ParsedForm from
 * gform.ts; no I/O.
 */
import { hasBranching, pageHistory, type CheckResult, type FormQuestion, type ParsedForm } from "./gform";

const pad = (text: string, width: number) => text.padEnd(width);

// The form title, then each page's questions as aligned columns with the
// options listed beneath. A branching option says where it leads.
export function renderQuestions(form: ParsedForm): string {
  const lines = [form.title || "(untitled form)", `${form.pageCount} page(s), ${form.questions.length} question(s)`];
  for (let page = 1; page <= form.pageCount; page++) {
    const questions = form.questions.filter((q) => q.page == page);
    const pageTitle = form.pageTitles[page];
    lines.push("", pageTitle ? `Page ${page}: ${pageTitle}` : `Page ${page}`);
    if (questions.length == 0) lines.push("  (no questions)");
    lines.push(...questionLines(questions));
  }
  if (hasBranching(form)) lines.push("", "This form branches: some options send the respondent to another page (shown as -> ...).");
  return lines.join("\n");
}

function questionLines(questions: FormQuestion[]): string[] {
  const widths = {
    title: Math.max(0, ...questions.map((q) => q.title.trim().length)),
    type: Math.max(0, ...questions.map((q) => q.type.length)),
    entry: Math.max(0, ...questions.map((q) => `entry.${q.entryID}`.length)),
  };
  return questions.flatMap((q) => [
    `  ${pad(q.title.trim(), widths.title)}  ${pad(q.type, widths.type)}  ${pad(`entry.${q.entryID}`, widths.entry)}  ${q.required ? "required" : "optional"}`,
    ...q.options.map((o) => `      - ${o.value}${o.goTo ? `  -> ${o.goTo}` : ""}`),
  ]);
}

// The pageHistory a direct submit needs, with the caveat that it only fits a
// form read straight through.
export function renderPageHistory(form: ParsedForm): string {
  const lines = [`pageHistory for a direct submit: ${pageHistory(form)}`];
  lines.push("It only applies to direct submits (postData true). The form is read in order, page by page.");
  if (hasBranching(form)) lines.push("This form branches, so use the pages the respondent actually passes through, not every page.");
  return lines.join("\n");
}

// A placeholder key for a question: its title in camelCase. The user renames
// it to match the code that reads the field.
export function keyFromTitle(title: string): string {
  const words = title.replace(/\(.*?\)/g, "").match(/[A-Za-z0-9]+/g) ?? [];
  if (words.length == 0) return "question";
  const key = words.map((word, i) => (i == 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase())).join("");
  return /^[0-9]/.test(key) ? `q${key[0].toUpperCase()}${key.slice(1)}` : key;
}

// A YAML scalar: plain when that is safe, otherwise double-quoted. JSON's
// string syntax is valid YAML double-quoting.
export function yamlString(value: string): string {
  const reserved = /^(yes|no|true|false|on|off|null|y|n)$/i;
  const plain = /^[A-Za-z][A-Za-z0-9 _./()'-]*$/.test(value) && !/\s$/.test(value) && !reserved.test(value);
  return plain ? value : JSON.stringify(value);
}

// The questions as a forms.yaml `fields:` list. Keys are placeholders, made
// unique within the form.
export function renderYamlSnippet(form: ParsedForm): string {
  const used = new Map<string, number>();
  const lines = ["fields:"];
  for (const q of form.questions) {
    const base = keyFromTitle(q.title);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    lines.push(`  - key: ${count == 1 ? base : `${base}${count}`}`);
    lines.push(`    title: ${yamlString(q.title.trim())}`);
    lines.push(`    entryID: ${q.entryID}`);
    if (q.options.length > 0) {
      lines.push("    options:", ...q.options.map((o) => `      - ${yamlString(o.value)}`));
    }
  }
  return lines.join("\n");
}

// The outcome of comparing forms.yaml's entry with the form.
export function renderCheck(name: string, result: CheckResult): string {
  const lines = [`Checking forms.yaml "${name}" against the form:`];
  result.warnings.forEach((w) => lines.push(`  warning: ${w}`));
  result.problems.forEach((p) => lines.push(`  PROBLEM: ${p}`));
  if (result.problems.length == 0) lines.push(result.warnings.length == 0 ? "  All fields match." : "  All entry IDs and options match (see the warnings above).");
  return lines.join("\n");
}
