import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { summarize } from "@covallaby/core";
import { describe, expect, it } from "vitest";
import {
  detectFormat,
  parseCobertura,
  parseCoverage,
  parseJacoco,
  parseXccov,
} from "../src/index.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const fixture = (name: string) => readFileSync(join(fixturesDir, name), "utf8");

describe("parseJacoco", () => {
  const report = parseJacoco(fixture("jacoco/basic.xml"));

  it("builds paths from package + sourcefile and maps ci to 0/1 hits", () => {
    // localeCompare collation: "com/…" sorts before "Main.java"
    expect(report.files.map((f) => f.path)).toEqual(["com/example/pay/Payment.java", "Main.java"]);
    const payment = report.files[0]!;
    expect(payment.lines).toEqual([
      { line: 7, hits: 1 },
      { line: 8, hits: 1 },
      { line: 9, hits: 1 },
      { line: 15, hits: 0 },
      { line: 16, hits: 0 },
    ]);
  });

  it("extracts branches from cb/mb and functions from class methods", () => {
    const payment = report.files[0]!;
    expect(payment.branches).toEqual([
      { line: 8, taken: 1, total: 2 },
      { line: 15, taken: 0, total: 2 },
    ]);
    expect(payment.functions).toEqual([
      { name: "charge", line: 7, hits: 1 },
      { name: "refund", line: 15, hits: 0 },
    ]);
  });

  it("recomputes summaries instead of trusting counters", () => {
    const summary = summarize(report);
    expect(summary.lines).toEqual({ covered: 4, total: 6, percent: expect.closeTo(66.66, 1) });
  });

  it("rejects XML without a report root", () => {
    expect(() => parseJacoco("<foo/>")).toThrowError(/no <report> root/);
  });
});

describe("parseCobertura", () => {
  const report = parseCobertura(fixture("cobertura/basic.xml"));

  it("keeps real hit counts and merges classes sharing a filename", () => {
    expect(report.files).toHaveLength(1);
    const payment = report.files[0]!;
    expect(payment.path).toBe("src/payment.py");
    expect(payment.lines).toEqual([
      { line: 4, hits: 9 },
      { line: 5, hits: 9 },
      { line: 6, hits: 3 },
      { line: 12, hits: 0 },
      { line: 13, hits: 0 },
      { line: 20, hits: 2 },
    ]);
  });

  it("parses condition-coverage into branches and methods into functions", () => {
    const payment = report.files[0]!;
    expect(payment.branches).toEqual([{ line: 5, taken: 1, total: 2 }]);
    expect(payment.functions).toEqual([
      { name: "charge", line: 4, hits: 9 },
      { name: "refund", line: 12, hits: 0 },
    ]);
  });

  it("rejects XML without a coverage root", () => {
    expect(() => parseCobertura("<report/>")).toThrowError(/no <coverage> root/);
  });
});

describe("parseXccov", () => {
  it("parses the per-line archive shape, taking max subrange counts", () => {
    const report = parseXccov(fixture("xccov/archive.json"), { stripPrefix: "/Users/dev/App" });
    expect(report.files.map((f) => f.path)).toEqual([
      "Sources/Checkout.swift",
      "Sources/Payment.swift",
    ]);
    const payment = report.files[1]!;
    expect(payment.lines).toEqual([
      { line: 2, hits: 8 },
      { line: 3, hits: 8 }, // partial line: executionCount null, max subrange wins
      { line: 4, hits: 0 },
    ]);
  });

  it("points users at the right command when given the summary shape", () => {
    expect(() => parseXccov(fixture("xccov/summary.json"))).toThrowError(
      /xcrun xccov view --archive --json/,
    );
  });
});

describe("detectFormat", () => {
  it("detects each format from content", () => {
    expect(detectFormat("SF:src/a.ts\nend_of_record")).toBe("lcov");
    expect(detectFormat(fixture("jacoco/basic.xml"))).toBe("jacoco");
    expect(detectFormat(fixture("cobertura/basic.xml"))).toBe("cobertura");
    expect(detectFormat(fixture("xccov/archive.json"))).toBe("xccov");
    expect(detectFormat("hello world")).toBeNull();
  });

  it("parseCoverage dispatches via detection and lists formats on failure", () => {
    expect(parseCoverage(fixture("cobertura/basic.xml")).files).toHaveLength(1);
    expect(() => parseCoverage("nope")).toThrowError(/lcov, jacoco, cobertura, xccov/);
  });
});
