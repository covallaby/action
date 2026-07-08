import {
  type CheckResult,
  type PatchSummary,
  type ReportSummary,
  type Thresholds,
  formatPercent,
} from "@covallaby/core";

/** GitHub caps rendered annotations at 10 per step; also our never-spam rule. */
export const ANNOTATION_CAP = 10;

export interface CommitStatus {
  context: "covallaby/project" | "covallaby/patch";
  state: "success" | "failure";
  description: string;
}

/**
 * The named entries for the PR checks list. Project always; patch only when
 * the diff had coverable lines. Without a threshold a status is informational
 * (always success) — the description still carries the number.
 */
export function buildStatuses(
  summary: ReportSummary,
  patch: PatchSummary | null,
  thresholds: Thresholds,
  result: CheckResult,
): CommitStatus[] {
  const statuses: CommitStatus[] = [];
  const failed = (kind: "project" | "patch" | "new-file") =>
    result.failures.some((f) => f.kind === kind);

  const describe = (percent: number | null, required: number | undefined) =>
    required === undefined
      ? formatPercent(percent)
      : `${formatPercent(percent)} (target ${formatPercent(required)})`;

  statuses.push({
    context: "covallaby/project",
    state: failed("project") ? "failure" : "success",
    description: describe(summary.lines.percent, thresholds.minProject),
  });

  if (patch && patch.lines.percent !== null) {
    statuses.push({
      context: "covallaby/patch",
      state: failed("patch") || failed("new-file") ? "failure" : "success",
      description: describe(patch.lines.percent, thresholds.minPatch),
    });
  }

  return statuses;
}

export interface CheckRun {
  name: "Covallaby";
  conclusion: "success" | "failure";
  /** One line: the verdict with the numbers that matter. */
  title: string;
}

/** The rich Checks-tab entry; its markdown body is the step summary. */
export function buildCheckRun(
  summary: ReportSummary,
  patch: PatchSummary | null,
  thresholds: Thresholds,
  result: CheckResult,
): CheckRun {
  const project = `project ${formatPercent(summary.lines.percent)}`;
  const patchPart =
    patch && patch.lines.percent !== null ? `patch ${formatPercent(patch.lines.percent)}` : null;
  const numbers = [patchPart, project].filter(Boolean).join(" · ");

  if (!result.ok) {
    const worst = result.failures[0]!;
    return {
      name: "Covallaby",
      conclusion: "failure",
      title: `${numbers} — ${worst.kind === "project" ? "project" : "patch"} needs ${formatPercent(worst.required)}`,
    };
  }
  return {
    name: "Covallaby",
    conclusion: "success",
    title: `You're covered — ${numbers}`,
  };
}

export interface Annotation {
  file: string;
  startLine: number;
  endLine: number;
  message: string;
}

/**
 * Warning annotations for uncovered changed lines, rendered by GitHub in the
 * PR diff. Returns at most `cap` annotations plus the count left unshown.
 */
export function buildAnnotations(
  patch: PatchSummary,
  cap: number = ANNOTATION_CAP,
): { annotations: Annotation[]; remaining: number } {
  const all: Annotation[] = [];
  for (const file of patch.files) {
    for (const [start, end] of file.uncovered) {
      const count = end - start + 1;
      all.push({
        file: file.path,
        startLine: start,
        endLine: end,
        message:
          count === 1
            ? "This changed line isn't covered by a test yet."
            : `These ${count} changed lines aren't covered by a test yet.`,
      });
    }
  }
  return { annotations: all.slice(0, cap), remaining: Math.max(0, all.length - cap) };
}
