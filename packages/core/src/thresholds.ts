import type { ReportSummary } from "./model.js";

export interface Thresholds {
  /** Minimum project line coverage percent (0–100). */
  minProject?: number;
}

export interface ThresholdFailure {
  kind: "project";
  actual: number | null;
  required: number;
  /** A friendly, actionable explanation — never just "coverage failed". */
  message: string;
}

export interface CheckResult {
  ok: boolean;
  failures: ThresholdFailure[];
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  // One decimal, floor — 84.97% must not round up past an 85% gate.
  return `${(Math.floor(value * 10) / 10).toFixed(1)}%`;
}

/**
 * Evaluate thresholds against a summary. Patch and new-file thresholds
 * arrive with diff support in Milestone 3.
 */
export function checkThresholds(summary: ReportSummary, thresholds: Thresholds): CheckResult {
  const failures: ThresholdFailure[] = [];

  if (thresholds.minProject !== undefined) {
    const actual = summary.lines.percent;
    if (actual === null || actual < thresholds.minProject) {
      const gap = actual === null ? null : thresholds.minProject - actual;
      const worst = [...summary.files]
        .filter((f) => f.lines.percent !== null && f.lines.percent < 100)
        .sort((a, b) => (a.lines.percent ?? 0) - (b.lines.percent ?? 0))
        .slice(0, 3);
      const hint =
        worst.length > 0
          ? `Start with ${worst.map((f) => `${f.path} (${formatPercent(f.lines.percent)})`).join(", ")}.`
          : "No coverable lines were found — check that the right coverage file was passed in.";
      failures.push({
        kind: "project",
        actual,
        required: thresholds.minProject,
        message:
          actual === null
            ? `Project coverage is required to be ${formatPercent(thresholds.minProject)}, but the report contains no coverable lines. ${hint}`
            : `Project coverage is ${formatPercent(actual)}, but ${formatPercent(thresholds.minProject)} is required (${formatPercent(gap)} to go). ${hint}`,
      });
    }
  }

  return { ok: failures.length === 0, failures };
}
