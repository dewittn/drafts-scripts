/**
 * Tests for the pure parts of `bun run gform`. The forms are synthetic: a page
 * built around hand-written FB_PUBLIC_LOAD_DATA_ arrays, not a real form.
 */
import { describe, expect, test } from "bun:test";
import yaml from "js-yaml";
import {
  baseFormURL,
  checkForm,
  extractFormData,
  GFormError,
  hasBranching,
  isLoginURL,
  pageHistory,
  parseForm,
  settingsFormNamed,
  viewFormURL,
} from "./gform";
import { keyFromTitle, renderCheck, renderPageHistory, renderQuestions, renderYamlSnippet, yamlString } from "./gform-report";

// A viewform page around a data array, with unrelated scripts either side.
const pageWith = (data: unknown) =>
  `<html><script>var other = {"a": 1};</script><script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(data)};</script></html>`;

// Items as the form data has them: [itemId, title, description, typeCode, answers].
const shortText = (id: number, title: string, entry: number, required = 0) => [id, title, null, 0, [[entry, null, required]]];
const dropdown = (id: number, title: string, entry: number, options: unknown[][]) => [id, title, null, 3, [[entry, options, 1]]];
const sectionBreak = (id: number, title: string | null = null) => [id, title, null, 8];
const textBlock = (id: number, title: string) => [id, title, null, 6];
const choice = (value: string, goTo: number | null = null) => [value, null, goTo, null, 0];

// Three pages: a name and a team, a section break, then a result and notes.
const linearData = [
  null,
  [
    "",
    [
      shortText(1, "Name: ", 111, 1),
      dropdown(2, "Team", 222, [choice("Varsity"), choice("JV")]),
      sectionBreak(10, "Game day"),
      textBlock(3, "Read this first"),
      dropdown(4, "Result", 333, [choice("Win"), choice("Loss")]),
      sectionBreak(11),
      [5, "Notes", null, 1, [[444, null, 0]]],
    ],
  ],
  null,
  "Score Form",
];

const linearForm = () => parseForm(linearData);

describe("extractFormData", () => {
  test("parses the array from the right script", () => {
    expect(extractFormData(pageWith(linearData))).toEqual(linearData);
  });

  test("finds the array when the page has more after it on the line", () => {
    const html = `${pageWith([1, ["a;b"]])}<script>var more = 1;</script>`;
    expect(extractFormData(html)).toEqual([1, ["a;b"]]);
  });

  test("a page without form data points at signing in and the saved-file route", () => {
    expect(() => extractFormData("<html>Sign in</html>")).toThrow(GFormError);
    expect(() => extractFormData("<html>Sign in</html>")).toThrow(/sign-in[\s\S]*Page Source[\s\S]*file path/);
  });

  test("data that is not JSON is an error, not a crash", () => {
    expect(() => extractFormData("<script>var FB_PUBLIC_LOAD_DATA_ = [oops;</script>")).toThrow(/could not be read/);
  });
});

describe("parseForm", () => {
  test("takes the form title", () => {
    expect(linearForm().title).toBe("Score Form");
  });

  test("numbers pages from 1, starting a new one at each section break", () => {
    const form = linearForm();
    expect(form.pageCount).toBe(3);
    expect(form.questions.map((q) => [q.title, q.page])).toEqual([
      ["Name: ", 1],
      ["Team", 1],
      ["Result", 2],
      ["Notes", 3],
    ]);
  });

  test("keeps a section break's title as its page title", () => {
    expect(linearForm().pageTitles).toEqual({ 2: "Game day" });
  });

  test("skips display-only items such as text blocks", () => {
    expect(linearForm().questions.some((q) => q.title == "Read this first")).toBe(false);
  });

  test("reads entry ID, type, required and options", () => {
    const [name, team, , notes] = linearForm().questions;
    expect(name).toMatchObject({ entryID: 111, type: "short text", required: true, options: [] });
    expect(team).toMatchObject({ entryID: 222, type: "dropdown", required: true });
    expect(team.options.map((o) => o.value)).toEqual(["Varsity", "JV"]);
    expect(notes).toMatchObject({ entryID: 444, type: "paragraph", required: false });
  });

  test("makes a question for each row of a grid", () => {
    const grid = [7, "Rate", null, 7, [[501, [["Good"], ["Bad"]], 1, ["Speed"]], [502, [["Good"], ["Bad"]], 1, ["Skill"]]]];
    const form = parseForm([null, ["", [grid]], null, "Grid"]);
    expect(form.questions.map((q) => [q.title, q.entryID, q.type])).toEqual([
      ["Rate [Speed]", 501, "grid"],
      ["Rate [Skill]", 502, "grid"],
    ]);
  });

  test("a form without a list of items is an error", () => {
    expect(() => parseForm([null, null])).toThrow(GFormError);
  });
});

describe("branching", () => {
  const branching = parseForm([
    null,
    [
      "",
      [
        dropdown(1, "Played?", 100, [choice("Yes", 20), choice("No", -3)]),
        sectionBreak(20),
        shortText(2, "Score", 200),
      ],
    ],
    null,
    "Branching",
  ]);

  test("a linear form is not flagged", () => {
    expect(hasBranching(linearForm())).toBe(false);
  });

  test("an option with a go-to section is flagged, and says where it leads", () => {
    expect(hasBranching(branching)).toBe(true);
    expect(branching.questions[0].options).toEqual([
      { value: "Yes", goTo: "page 2" },
      { value: "No", goTo: "submit form" },
    ]);
  });

  test("the report says the form branches and marks the options", () => {
    const text = renderQuestions(branching);
    expect(text).toContain("- Yes  -> page 2");
    expect(text).toContain("This form branches");
    expect(renderQuestions(linearForm())).not.toContain("branches");
  });
});

describe("pageHistory", () => {
  test("counts every page from 0", () => {
    expect(pageHistory(linearForm())).toBe("0,1,2");
    expect(pageHistory(parseForm([null, ["", [shortText(1, "A", 1)]], null, "One page"]))).toBe("0");
  });

  test("the report says it only applies to direct submits, and warns about branching", () => {
    expect(renderPageHistory(linearForm())).toMatch(/0,1,2[\s\S]*direct submits/);
    expect(renderPageHistory(linearForm())).not.toContain("branches");
    const branching = parseForm([null, ["", [dropdown(1, "Q", 1, [choice("A", -3)])]], null, "B"]);
    expect(renderPageHistory(branching)).toContain("This form branches");
  });
});

describe("renderQuestions", () => {
  test("groups by page and shows title, type, entry, required and options", () => {
    const text = renderQuestions(linearForm());
    expect(text.split("\n")[0]).toBe("Score Form");
    expect(text).toContain("3 page(s), 4 question(s)");
    expect(text).toMatch(/Page 1\n\s+Name:\s+short text\s+entry\.111\s+required/);
    expect(text).toContain("Page 2: Game day");
    expect(text).toMatch(/Result\s+dropdown\s+entry\.333\s+required\n\s+- Win\n\s+- Loss/);
    expect(text).toMatch(/Notes\s+paragraph\s+entry\.444\s+optional/);
  });
});

describe("renderYamlSnippet", () => {
  test("is a fields list in the shape forms.yaml uses", () => {
    const snippet = yaml.load(renderYamlSnippet(linearForm())) as { fields: Record<string, unknown>[] };
    expect(snippet.fields).toEqual([
      { key: "name", title: "Name:", entryID: 111 },
      { key: "team", title: "Team", entryID: 222, options: ["Varsity", "JV"] },
      { key: "result", title: "Result", entryID: 333, options: ["Win", "Loss"] },
      { key: "notes", title: "Notes", entryID: 444 },
    ]);
  });

  test("keys are made unique within the form", () => {
    const form = parseForm([null, ["", [shortText(1, "Score", 1), shortText(2, "Score", 2)]], null, "Dupes"]);
    const snippet = yaml.load(renderYamlSnippet(form)) as { fields: { key: string }[] };
    expect(snippet.fields.map((f) => f.key)).toEqual(["score", "score2"]);
  });

  test("quotes options that YAML would read as something else", () => {
    const form = parseForm([null, ["", [dropdown(1, "Report?", 1, [choice("Yes"), choice("No"), choice("3 goals"), choice("Not: applicable")])]], null, "Q"]);
    const snippet = yaml.load(renderYamlSnippet(form)) as { fields: { options: unknown[] }[] };
    expect(snippet.fields[0].options).toEqual(["Yes", "No", "3 goals", "Not: applicable"]);
  });
});

describe("helpers", () => {
  test("keyFromTitle makes camelCase from the title", () => {
    expect(keyFromTitle("Select your team: ")).toBe("selectYourTeam");
    expect(keyFromTitle("Date of Contest")).toBe("dateOfContest");
    expect(keyFromTitle("Which team(s) play?")).toBe("whichTeamPlay");
    expect(keyFromTitle("???")).toBe("question");
    expect(keyFromTitle("2nd half")).toBe("q2ndHalf");
  });

  test("yamlString leaves safe text plain and quotes the rest", () => {
    expect(yamlString("Win")).toBe("Win");
    expect(yamlString("Yes")).toBe('"Yes"');
    expect(yamlString("Highlights?")).toBe('"Highlights?"');
  });
});

describe("URL normalization", () => {
  const base = "https://docs.google.com/forms/d/e/1FAIpQLSabc";

  test("every kind of form link becomes the viewform link", () => {
    for (const tail of ["", "/", "/viewform", "/viewform?usp=pp_url&entry.1=x", "/formResponse", "/edit", "/edit#responses"]) {
      expect(viewFormURL(base + tail)).toBe(`${base}/viewform`);
    }
  });

  test("baseFormURL drops the page, query and trailing slash", () => {
    expect(baseFormURL(` ${base}/viewform?x=1 `)).toBe(base);
  });

  test("things that are not web links are rejected", () => {
    expect(viewFormURL("form.html")).toBeUndefined();
    expect(viewFormURL("")).toBeUndefined();
  });

  test("a short link is fetched as it is", () => {
    expect(viewFormURL("https://forms.gle/abc123")).toBe("https://forms.gle/abc123");
  });

  test("a redirect to Google's sign-in page is recognised", () => {
    expect(isLoginURL("https://accounts.google.com/v3/signin/identifier?continue=x")).toBe(true);
    expect(isLoginURL(`${base}/viewform`)).toBe(false);
  });
});

describe("checkForm", () => {
  const field = (extra: object) => ({ key: "k", title: "Team", entryID: 222, ...extra });

  test("all fields matching is clean", () => {
    const result = checkForm(linearForm(), {
      fields: [field({ options: ["Varsity", "JV"] }), { key: "name", title: "Name:", entryID: 111 }],
    });
    expect(result).toEqual({ problems: [], warnings: [] });
    expect(renderCheck("score", result)).toContain("All fields match.");
  });

  test("an entry ID that is not in the form is a problem", () => {
    const result = checkForm(linearForm(), { fields: [field({ entryID: 999, key: "gone" })] });
    expect(result.problems).toEqual(["gone (entryID 999): no question in the form has this entry ID"]);
    expect(renderCheck("score", result)).toContain("PROBLEM: gone (entryID 999)");
  });

  test("an option the form does not offer is a problem", () => {
    const result = checkForm(linearForm(), { fields: [field({ options: ["Varsity", "Middle School"] })] });
    expect(result.problems).toEqual([`k (entryID 222): "Middle School" is not one of the form's options`]);
  });

  test("a changed title is a warning only", () => {
    const result = checkForm(linearForm(), { fields: [field({ title: "Which team?" })] });
    expect(result.problems).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain(`the form now titles it "Team", forms.yaml has "Which team?"`);
    expect(renderCheck("score", result)).not.toContain("All fields match.");
  });

  test("a trailing space in the form's title is not a change", () => {
    expect(checkForm(linearForm(), { fields: [{ key: "n", title: "Name:", entryID: 111 }] }).warnings).toEqual([]);
  });

  test("settingsFormNamed finds an entry, or lists the ones there are", () => {
    const forms = { "ms-score": { title: "MS" }, varsity: { title: "V" } };
    expect(settingsFormNamed(forms, "varsity")).toEqual({ title: "V" });
    expect(() => settingsFormNamed(forms, "nope")).toThrow(/ms-score, varsity/);
  });
});
