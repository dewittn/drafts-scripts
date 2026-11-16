import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundle } from "./community";

// A Library/Scripts stand-in with two modules, one requiring the other.
function scriptsDir() {
  const dir = mkdtempSync(join(tmpdir(), "community-"));
  mkdirSync(join(dir, "modules"));
  writeFileSync(join(dir, "modules/Base.js"), "class Base {}\n");
  writeFileSync(join(dir, "modules/Child.js"), 'require("modules/Base.js");\nclass Child extends Base {}\n');
  return dir;
}

describe("bundle", () => {
  test("replaces a require line with the file it names", () => {
    const out = bundle('require("modules/Base.js");\nnew Base();', scriptsDir());
    expect(out).toContain("class Base {}");
    expect(out).not.toContain("require(");
    expect(out.endsWith("new Base();")).toBe(true);
  });

  test("inlines nested requires and includes each file once", () => {
    const out = bundle('require("modules/Child.js");\nrequire("modules/Base.js");', scriptsDir());
    expect(out.match(/class Base \{\}/g)?.length).toBe(1);
    expect(out.indexOf("class Base")).toBeLessThan(out.indexOf("class Child"));
  });

  test("fails when a required file is missing", () => {
    expect(() => bundle('require("modules/Missing.js");', scriptsDir())).toThrow();
  });
});
