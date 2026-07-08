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
    expect(failure.message).toContain("src/a.ts");
  });

  it("passes when no thresholds are configured", () => {
    expect(checkThresholds(summarize(reportWithCoverage(0)), {}).ok).toBe(true);
  });
});
