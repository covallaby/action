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
  context: "covallaby/project" | "covallaby/patch" | "covallaby/journeys" | "covallaby/components";
  state: "success" | "failure" | "pending";
  description: string;
  /** Deep link to this signal's page on the Covallaby dashboard ("Details" in the PR UI). */
  targetUrl?: string;
}

/**
 * The named coverage entries for the PR checks list. Project always; patch
 * only when the diff had coverable lines. Without a threshold a status is
 * informational (always success) — the description still carries the number.
 * `coverageUrl` (the hosted upload's report page) becomes the Details link.
 */
export function buildStatuses(
  summary: ReportSummary,
  patch: PatchSummary | null,
  thresholds: Thresholds,
  result: CheckResult,
  coverageUrl?: string,
): CommitStatus[] {
  const statuses: CommitStatus[] = [];
  const failed = (kind: "project" | "patch" | "new-file") =>
    result.failures.some((f) => f.kind === kind);
  const target = coverageUrl ? { targetUrl: coverageUrl } : {};

  const describe = (percent: number | null, required: number | undefined) =>
    required === undefined
      ? formatPercent(percent)
      : `${formatPercent(percent)} (target ${formatPercent(required)})`;

  statuses.push({
    context: "covallaby/project",
    state: failed("project") ? "failure" : "success",
    description: describe(summary.lines.percent, thresholds.minProject),
    ...target,
  });

  if (patch && patch.lines.percent !== null) {
    statuses.push({
      context: "covallaby/patch",
      state: failed("patch") || failed("new-file") ? "failure" : "success",
      description: describe(patch.lines.percent, thresholds.minPatch),
      ...target,
    });
  }

  return statuses;
}

/**
 * The browser-journey entry: the Playwright run's outcome for this commit,
 * deep-linked to its playback page on the dashboard.
 */
export function buildJourneysStatus(playback: {
  url: string;
  tests: { passed: number; failed: number; skipped: number };
}): CommitStatus {
  const { passed, failed, skipped } = playback.tests;
  const ran = passed + failed;
  return {
    context: "covallaby/journeys",
    state: failed > 0 ? "failure" : "success",
    description:
      failed > 0
        ? `${failed} of ${ran} ${ran === 1 ? "journey" : "journeys"} failed`
        : `${passed} ${passed === 1 ? "journey" : "journeys"} passed${skipped > 0 ? ` (${skipped} skipped)` : ""}`,
    targetUrl: playback.url,
  };
}

/**
 * The component-capture entry, deep-linked to the visual review page. CI only
 * knows the state at upload time (pending review, or auto-accepted on the
 * default branch); once a human approves or rejects on the dashboard, the
 * Covallaby server updates this same context with the verdict.
 */
export function buildComponentsStatus(preview: {
  url: string;
  captures: number;
  reviewState: string;
}): CommitStatus {
  const base = { context: "covallaby/components" as const, targetUrl: preview.url };
  if (preview.reviewState === "rejected") {
    return { ...base, state: "failure", description: "Visual changes rejected in review" };
  }
  if (preview.reviewState === "approved") {
    return { ...base, state: "success", description: "Visual changes approved in review" };
  }
  if (preview.reviewState === "auto-accepted") {
    return {
      ...base,
      state: "success",
      description: "Auto-accepted as the default-branch baseline",
    };
  }
  if (preview.captures === 0) {
    return { ...base, state: "success", description: "Component preview published (no captures)" };
  }
  return {
    ...base,
    state: "pending",
    description: `${preview.captures} component ${preview.captures === 1 ? "capture awaits" : "captures await"} visual review`,
  };
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
