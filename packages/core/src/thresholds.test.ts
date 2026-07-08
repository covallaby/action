import { describe, expect, it } from "vitest";
import { type CoverageReport, summarize } from "./model.js";
import { checkThresholds, formatPercent } from "./thresholds.js";

function reportWithCoverage(coveredOfTen: number): CoverageReport {
  return {
    files: [
      {
        path: "src/a.ts",
        lines: Array.from({ length: 10 }, (_, i) => ({
          line: i + 1,
          hits: i < coveredOfTen ? 1 : 0,
        })),
        functions: [],
        branches: [],
      },
    ],
  };
}

describe("formatPercent", () => {
  it("floors instead of rounding up past a gate", () => {
    expect(formatPercent(84.97)).toBe("84.9%");
    expect(formatPercent(100)).toBe("100.0%");
    expect(formatPercent(null)).toBe("—");
  });
});

describe("checkThresholds", () => {
  it("passes when project coverage meets the bar", () => {
    const result = checkThresholds(summarize(reportWithCoverage(9)), { minProject: 85 });
    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails with an actionable message naming the worst files", () => {
    const result = checkThresholds(summarize(reportWithCoverage(6)), { minProject: 85 });
    expect(result.ok).toBe(false);
    const failure = result.failures[0]!;
    expect(failure.kind).toBe("project");
    expect(failure.required).toBe(85);
    expect(failure.message).toContain("60.0%");
    expect(failure.message).toContain("85.0%");
    expect(failure.hint).toContain("src/a.ts");
  });

  it("passes when no thresholds are configured", () => {
    expect(checkThresholds(summarize(reportWithCoverage(0)), {}).ok).toBe(true);
  });
});

describe("checkThresholds with patch coverage", () => {
  const summary = summarize(reportWithCoverage(10));
  const patch = (percentCovered: number, added = false) => ({
    lines: { covered: percentCovered, total: 100, percent: percentCovered },
    files: [
      {
        path: "src/a.ts",
        added,
        lines: { covered: percentCovered, total: 100, percent: percentCovered },
        uncovered: [[7, 9]] as Array<[number, number]>,
      },
    ],
  });

  it("fails patch threshold with the uncovered spots", () => {
    const result = checkThresholds(summary, { minPatch: 85 }, patch(60));
    expect(result.ok).toBe(false);
    const failure = result.failures[0]!;
    expect(failure.kind).toBe("patch");
    expect(failure.hint).toContain("src/a.ts:7-9");
    expect(failure.message).toContain("40 changed lines aren't covered yet");
  });

  it("treats a docs-only patch (no coverable lines) as a pass", () => {
    const empty = { lines: { covered: 0, total: 0, percent: null }, files: [] };
    expect(checkThresholds(summary, { minPatch: 85 }, empty).ok).toBe(true);
  });

  it("gates each added file with min-new-file", () => {
    const result = checkThresholds(summary, { minNewFile: 90 }, patch(60, true));
    expect(result.failures.map((f) => f.kind)).toEqual(["new-file"]);
    expect(result.failures[0]!.message).toContain("New file src/a.ts");
    // existing files are exempt
    expect(checkThresholds(summary, { minNewFile: 90 }, patch(60, false)).ok).toBe(true);
  });
});

describe("formatPercent floating-point", () => {
  it("does not floor exact percentages a tenth low", () => {
    expect(formatPercent((29 / 100) * 100)).toBe("29.0%"); // 28.999… must not become 28.9
    expect(formatPercent((23 / 40) * 100)).toBe("57.5%");
  });
});
