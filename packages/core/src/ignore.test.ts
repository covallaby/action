import { describe, expect, it } from "vitest";
import { ignorePaths, pathMatcher } from "./ignore.js";
import type { CoverageReport } from "./model.js";

const file = (path: string) => ({ path, lines: [], functions: [], branches: [] });
const report = (...paths: string[]): CoverageReport => ({ files: paths.map(file) });
const kept = (r: CoverageReport, patterns: string[]) =>
  ignorePaths(r, patterns).files.map((f) => f.path);

describe("pathMatcher", () => {
  const hit = (pattern: string, path: string) => pathMatcher(pattern).test(path);

  it("bare names match at any depth (dir or file)", () => {
    expect(hit("node_modules", "node_modules/x.js")).toBe(true);
    expect(hit("node_modules", "pkg/node_modules/y.js")).toBe(true);
    expect(hit("node_modules", "src/app.ts")).toBe(false);
    expect(hit("*.test.ts", "src/a.test.ts")).toBe(true);
    expect(hit("*.test.ts", "a.test.ts")).toBe(true);
    expect(hit("*.test.ts", "src/a.ts")).toBe(false);
  });

  it("`*` stays within a segment; `**` spans directories", () => {
    expect(hit("src/*.ts", "src/a.ts")).toBe(true);
    expect(hit("src/*.ts", "src/sub/a.ts")).toBe(false); // * doesn't cross /
    expect(hit("src/**", "src/sub/a.ts")).toBe(true);
    expect(hit("**/*.gen.ts", "a/b/c.gen.ts")).toBe(true);
    expect(hit("**/*.gen.ts", "c.gen.ts")).toBe(true); // **/ = zero+ dirs
  });

  it("slash-bearing patterns anchor at the root", () => {
    expect(hit("tests/**", "tests/x.ts")).toBe(true);
    expect(hit("tests/**", "src/tests/x.ts")).toBe(false); // anchored
    expect(hit("dist", "dist/bundle.js")).toBe(true);
  });
});

describe("ignorePaths", () => {
  it("drops matching files and keeps the rest", () => {
    const r = report("src/a.ts", "src/a.test.ts", "node_modules/dep.js", "gen/schema.gen.ts");
    expect(kept(r, ["*.test.ts", "node_modules", "**/*.gen.ts"])).toEqual(["src/a.ts"]);
  });

  it("returns the report unchanged with no patterns", () => {
    const r = report("a.ts", "b.ts");
    expect(ignorePaths(r, [])).toBe(r);
    expect(kept(r, ["   "])).toEqual(["a.ts", "b.ts"]);
  });
});
