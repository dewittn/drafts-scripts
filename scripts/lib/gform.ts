/**
 * Pure parts of `bun run gform`: finding a Google Form's data in its page,
 * turning that data into questions grouped by page, and checking the questions
 * against an entry in forms.yaml. No file or network I/O, and no printing
 * (gform-report.ts renders the results).
 *
 * A form's viewform page carries `var FB_PUBLIC_LOAD_DATA_ = [...];` in a
 * script. In that array, d[3] is the form title and d[1][1] the list of items:
 *   [itemId, title, description, typeCode, answers, ...]
 * `answers` is a list of [entryId, options, required, ...] and each option is
 * [value, ?, goToSectionId, ...]. A type 8 item is a section break that starts
 * a new page. Items without answers (text blocks, images, videos) are display only.
 */

// Thrown for problems the user can act on; the CLI prints the message alone.
export class GFormError extends Error {}

export interface FormOption {
  value: string;
  // Where choosing this option sends the respondent, when the form branches.
  goTo?: string;
}

export interface FormQuestion {
  page: number;
  title: string;
  type: string;
  entryID: number;
  required: boolean;
  options: FormOption[];
}

export interface ParsedForm {
  title: string;
  pageCount: number;
  // Page titles by page number, for pages whose section break has one.
  pageTitles: Record<number, string>;
  questions: FormQuestion[];
}

// What a forms.yaml entry's fields look like, as far as the check reads them.
export interface SettingsField {
  key?: string;
  title?: string;
  entryID: number;
  options?: unknown[];
}

export interface SettingsForm {
  title?: string;
  fields?: SettingsField[];
}

export interface CheckResult {
  problems: string[];
  warnings: string[];
}

const DATA_MARKER = "FB_PUBLIC_LOAD_DATA_ = ";
const SECTION_BREAK = 8;

const TYPE_NAMES: Record<number, string> = {
  0: "short text",
  1: "paragraph",
  2: "multiple choice",
  3: "dropdown",
  4: "checkboxes",
  5: "linear scale",
  7: "grid",
  9: "date",
  10: "time",
};

// Go-to values that name no section.
const SUBMIT_FORM = -3;

export const loginHelp = `This form probably needs a sign-in, so the page came back without its questions.
Save the form's page source from a browser where you are signed in:
  Safari:  Develop > Show Page Source, then File > Save As... > Page Source
  Chrome:  View > Developer > View Source, then save the page (Cmd+S)
Then run again with the file path: bun run gform path/to/form.html`;

// --- Input ---

// The form's base link from whatever was pasted: drops a query string, a
// trailing /viewform, /formResponse or /edit, and a trailing slash. Returns
// undefined for anything that is not a web link. (GoogleForm.baseURL in the
// Drafts scripts does the same.)
export function baseFormURL(pasted: string): string | undefined {
  const url = pasted.trim().split(/[?#]/)[0];
  if (!/^https?:\/\/\S+$/.test(url)) return undefined;
  return url.replace(/\/(viewform|formResponse|edit)\/?$/, "").replace(/\/+$/, "");
}

// The link to fetch: the form's viewform page. A link that is not a
// docs.google.com form (a forms.gle short link, say) is fetched as it is and
// redirects to the form.
export function viewFormURL(pasted: string): string | undefined {
  const base = baseFormURL(pasted);
  if (base == undefined) return undefined;
  return base.includes("/forms/") ? `${base}/viewform` : base;
}

export const isLoginURL = (url: string) => new URL(url).hostname == "accounts.google.com";

// The parsed FB_PUBLIC_LOAD_DATA_ array in a viewform page.
export function extractFormData(html: string): unknown[] {
  const start = html.indexOf(DATA_MARKER);
  if (start == -1) throw new GFormError(`The page has no form data (FB_PUBLIC_LOAD_DATA_).\n${loginHelp}`);
  const from = start + DATA_MARKER.length;
  const end = html.indexOf(";</script>", from);
  try {
    const data = JSON.parse(html.slice(from, end == -1 ? undefined : end));
    if (Array.isArray(data)) return data;
  } catch {
    // falls through to the error below
  }
  throw new GFormError("The form data in the page could not be read. Google may have changed its format.");
}

// --- Parsing ---

type Raw = any[];

// The form's questions grouped by page. Display-only items are skipped; a
// section break starts the next page.
export function parseForm(data: unknown[]): ParsedForm {
  const root = data as Raw;
  const items: Raw[] = root[1]?.[1];
  if (!Array.isArray(items)) throw new GFormError("The form data has no list of questions. Google may have changed its format.");

  const sectionPages = pagesBySectionID(items);
  const form: ParsedForm = { title: root[3] ?? root[1][0] ?? "", pageCount: 1, pageTitles: {}, questions: [] };
  for (const item of items) {
    if (item[3] == SECTION_BREAK) {
      form.pageCount += 1;
      if (item[1]) form.pageTitles[form.pageCount] = item[1];
      continue;
    }
    form.questions.push(...questionsOf(item, form.pageCount, sectionPages));
  }
  return form;
}

// Section item ids to the page each one starts. Go-to values name sections.
function pagesBySectionID(items: Raw[]): Map<number, number> {
  const pages = new Map<number, number>();
  items.filter((item) => item[3] == SECTION_BREAK).forEach((item, i) => pages.set(item[0], i + 2));
  return pages;
}

// One question per answer entry: most items have one, a grid has one per row.
function questionsOf(item: Raw, page: number, sectionPages: Map<number, number>): FormQuestion[] {
  const answers: Raw[] = item[4] ?? [];
  const isGrid = item[3] == 7;
  return answers.map((answer) => ({
    page,
    title: isGrid ? `${item[1] ?? ""} [${answer[3]?.[0] ?? ""}]` : item[1] ?? "",
    type: TYPE_NAMES[item[3]] ?? `type ${item[3]}`,
    entryID: answer[0],
    required: answer[2] == 1,
    options: (answer[1] ?? []).map((option: Raw) => optionOf(option, sectionPages)),
  }));
}

function optionOf(option: Raw, sectionPages: Map<number, number>): FormOption {
  const goTo = option[2];
  return goTo == null ? { value: String(option[0]) } : { value: String(option[0]), goTo: describeGoTo(goTo, sectionPages) };
}

function describeGoTo(goTo: number, sectionPages: Map<number, number>): string {
  if (goTo == SUBMIT_FORM) return "submit form";
  const page = sectionPages.get(goTo);
  return page != undefined ? `page ${page}` : `section ${goTo}`;
}

export const hasBranching = (form: ParsedForm) => form.questions.some((q) => q.options.some((o) => o.goTo != undefined));

// The pageHistory value for a direct submit of a form without branching: every
// page, in order, counting from 0.
export function pageHistory(form: ParsedForm): string {
  return Array.from({ length: form.pageCount }, (_, i) => i).join(",");
}

// --- Checking against forms.yaml ---

// The entry named `name` in the parsed forms.yaml.
export function settingsFormNamed(forms: unknown, name: string): SettingsForm {
  const all = (forms ?? {}) as Record<string, SettingsForm>;
  const found = all[name];
  if (found == undefined) throw new GFormError(`forms.yaml has no form named "${name}". It has: ${Object.keys(all).join(", ")}`);
  return found;
}

// Compares a forms.yaml entry with the scraped form. A missing entry ID or an
// option the form does not offer is a problem (a submit would fail or land in
// the wrong place); a changed title is only a warning.
export function checkForm(form: ParsedForm, settings: SettingsForm): CheckResult {
  const result: CheckResult = { problems: [], warnings: [] };
  for (const field of settings.fields ?? []) {
    const label = `${field.key ?? "?"} (entryID ${field.entryID})`;
    const question = form.questions.find((q) => q.entryID == field.entryID);
    if (question == undefined) {
      result.problems.push(`${label}: no question in the form has this entry ID`);
      continue;
    }
    if (field.title != undefined && field.title.trim() != question.title.trim()) {
      result.warnings.push(`${label}: the form now titles it "${question.title.trim()}", forms.yaml has "${field.title.trim()}"`);
    }
    const offered = question.options.map((option) => option.value);
    for (const wanted of (field.options ?? []).map(String)) {
      if (!offered.includes(wanted)) result.problems.push(`${label}: "${wanted}" is not one of the form's options`);
    }
  }
  return result;
}
