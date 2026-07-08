import { describe, expect, it } from "vitest";
import {
  type CoverageReport,
  formatRanges,
  mergeReports,
  summarize,
  uncoveredRanges,
} from "./model.js";

const report: CoverageReport = {
  files: [
    {
      path: "src/payment.ts",
      lines: [
        { line: 1, hits: 3 },
        { line: 2, hits: 0 },
        { line: 3, hits: 0 },
        { line: 5, hits: 1 },
        { line: 9, hits: 0 },
      ],
      functions: [
        { name: "charge", line: 1, hits: 3 },
        { name: "refund", line: 5, hits: 0 },
      ],
      branches: [{ line: 2, taken: 1, total: 2 }],
    },
    {
      path: "src/util.ts",
      lines: [{ line: 1, hits: 1 }],
      functions: [],
      branches: [],
    },
  ],
};

describe("summarize", () => {
  it("computes counts and percentages from raw hits", () => {
    const summary = summarize(report);
    expect(summary.totalFiles).toBe(2);
    expect(summary.lines).toEqual({ covered: 3, total: 6, percent: 50 });
    expect(summary.functions).toEqual({ covered: 1, total: 2, percent: 50 });
    expect(summary.branches).toEqual({ covered: 1, total: 2, percent: 50 });
  });

  it("uses null percent when there is nothing to cover", () => {
    const summary = summarize({ files: [] });
    expect(summary.lines.percent).toBeNull();
  });
});

describe("uncoveredRanges", () => {
  it("collapses consecutive uncovered lines into ranges", () => {
    const ranges = uncoveredRanges(report.files[0]!);
    expect(ranges).toEqual([
      [2, 3],
      [9, 9],
    ]);
    expect(formatRanges(ranges)).toBe("2-3, 9");
  });
});

describe("mergeReports", () => {
  it("sums line hits across reports for the same file", () => {
    const shard: CoverageReport = {
      files: [
        {
          path: "src/payment.ts",
          lines: [
            { line: 2, hits: 4 },
            { line: 9, hits: 0 },
          ],
          functions: [{ name: "refund", line: 5, hits: 2 }],
          branches: [{ line: 2, taken: 2, total: 2 }],
        },
      ],
    };
    const merged = mergeReports([report, shard]);
    const payment = merged.files.find((f) => f.path === "src/payment.ts")!;
    expect(payment.lines.find((l) => l.line === 2)!.hits).toBe(4);
    expect(payment.functions.find((f) => f.name === "refund")!.hits).toBe(2);
    expect(payment.branches[0]).toEqual({ line: 2, taken: 2, total: 2 });
    // line 3 still uncovered, line 9 still uncovered
    expect(uncoveredRanges(payment)).toEqual([
      [3, 3],
      [9, 9],
    ]);
  });
});
