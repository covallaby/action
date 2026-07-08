import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { summarize } from "@covallaby/core";
import { describe, expect, it } from "vitest";
import { ParseError, detectFormat, parseCoverage, parseLcov } from "../src/index.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "lcov");
const fixture = (name: string) => readFileSync(join(fixturesDir, name), "utf8");

describe("parseLcov", () => {
  it("parses a typical tracefile into the shared model", () => {
    const report = parseLcov(fixture("basic.info"));
    expect(report.files.map((f) => f.path)).toEqual(["src/payment.ts", "src/util.ts"]);

    const payment = report.files[0]!;
    expect(payment.lines).toEqual([
      { line: 1, hits: 5 },
      { line: 2, hits: 5 },
      { line: 3, hits: 0 },
      { line: 4, hits: 0 },
      { line: 12, hits: 0 },
      { line: 13, hits: 0 },
    ]);
    expect(payment.functions).toEqual([
      { name: "charge", line: 1, hits: 5 },
      { name: "refund", line: 12, hits: 0 },
    ]);
    // Two BRDA records on line 2: one taken 4 times, one never ("-").
    expect(payment.branches).toEqual([{ line: 2, taken: 1, total: 2 }]);
  });

  it("recomputes summaries instead of trusting LF/LH records", () => {
    const summary = summarize(parseLcov(fixture("basic.info")));
    expect(summary.lines).toEqual({ covered: 4, total: 8, percent: 50 });
    expect(summary.functions.covered).toBe(1);
  });

  it("strips a prefix so paths become repo-relative", () => {
    const report = parseLcov(fixture("absolute-paths.info"), {
      stripPrefix: "/home/runner/work/app/app",
    });
    expect(report.files[0]!.path).toBe("src/index.ts");
  });

  it("rejects malformed records with the offending line number", () => {
    expect(() => parseLcov(fixture("malformed.info"))).toThrowError(
      /Invalid DA record.*\(line 2\)/,
    );
  });

  it("rejects content with no LCOV records at all", () => {
    expect(() => parseLcov("hello\nworld")).toThrow(ParseError);
    expect(() => parseLcov("")).toThrowError(/no SF: records/);
  });

  it("tolerates a missing trailing end_of_record", () => {
    const report = parseLcov("SF:a.ts\nDA:1,1");
    expect(report.files).toHaveLength(1);
  });
});

describe("detectFormat / parseCoverage", () => {
  it("detects LCOV", () => {
    expect(detectFormat(fixture("basic.info"))).toBe("lcov");
    expect(detectFormat("<xml/>")).toBeNull();
  });

  it("gives a friendly error for unknown formats", () => {
    expect(() => parseCoverage("no format here")).toThrowError(/lcov, jacoco, cobertura, xccov/);
  });
});
