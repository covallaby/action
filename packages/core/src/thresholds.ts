import type { PatchSummary } from "./diff.js";
import { type ReportSummary, formatRanges } from "./model.js";

export interface Thresholds {
  /** Minimum project line coverage percent (0–100). */
  minProject?: number;
  /** Minimum coverage percent of the lines changed in the PR. */
  minPatch?: number;
  /** Minimum coverage percent for each file added in the PR. */
  minNewFile?: number;
}

export interface ThresholdFailure {
  kind: "project" | "patch" | "new-file";
  actual: number | null;
  required: number;
  /** A friendly, factual explanation — never just "coverage failed". */
  message: string;
  /** Where to start fixing it. Shown in logs; comments show their own list. */
  hint?: string;
}

export interface CheckResult {
  ok: boolean;
  failures: ThresholdFailure[];
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  // One decimal, floor — 84.97% must not round up past an 85% gate.
  return `${(Math.floor(value * 10 + 1e-9) / 10).toFixed(1)}%`;
}

/**
 * Evaluate thresholds. `patch` is required for the patch/new-file gates and
 * comes from computePatchCoverage (Action or `covallaby compare`).
 */
export function checkThresholds(
  summary: ReportSummary,
  thresholds: Thresholds,
  patch?: PatchSummary,
): CheckResult {
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
            ? `Project coverage is required to be ${formatPercent(thresholds.minProject)}, but the report contains no coverable lines.`
            : `Project coverage is ${formatPercent(actual)}, but ${formatPercent(thresholds.minProject)} is required (${formatPercent(gap)} to go).`,
        hint,
      });
    }
  }

  if (thresholds.minPatch !== undefined && patch) {
    const actual = patch.lines.percent;
    // No coverable changed lines (docs-only PR, config, …) is a pass, not a fail.
    if (actual !== null && actual < thresholds.minPatch) {
      const spots = patch.files
        .filter((f) => f.uncovered.length > 0)
        .slice(0, 3)
        .map((f) => `${f.path}:${formatRanges(f.uncovered)}`);
      const missing = patch.lines.total - patch.lines.covered;
      const notCovered = `${missing} changed ${missing === 1 ? "line isn't" : "lines aren't"} covered yet`;
      failures.push({
        kind: "patch",
        actual,
        required: thresholds.minPatch,
        message: `Patch coverage is ${formatPercent(actual)}, but ${formatPercent(thresholds.minPatch)} is required. ${notCovered}.`,
        ...(spots.length > 0 && { hint: `Start with ${spots.join(", ")}.` }),
      });
    }
  }

  if (thresholds.minNewFile !== undefined && patch) {
    for (const file of patch.files) {
      if (!file.added) continue;
      const actual = file.lines.percent;
      if (actual !== null && actual < thresholds.minNewFile) {
        failures.push({
          kind: "new-file",
          actual,
          required: thresholds.minNewFile,
          message: `New file ${file.path} is ${formatPercent(actual)} covered, but new files need ${formatPercent(thresholds.minNewFile)}.`,
          hint: `Uncovered lines: ${formatRanges(file.uncovered)}.`,
        });
      }
    }
  }

  return { ok: failures.length === 0, failures };
}
