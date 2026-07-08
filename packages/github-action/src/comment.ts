import {
  type CheckResult,
  type PatchSummary,
  type ReportSummary,
  type Thresholds,
  formatPercent,
  formatRanges,
  rollupByDirectory,
} from "@covallaby/core";

export const COMMENT_MARKER = "<!-- covallaby-report:v1 -->";

export interface CommentInput {
  summary: ReportSummary;
  patch: PatchSummary | null;
  thresholds: Thresholds;
  result: CheckResult;
}

function headline({ result, patch, summary }: CommentInput): string {
  if (!result.ok) {
    const n = result.failures.length;
    return `${n === 1 ? "One thing" : `${n} things`} to look at before merging.`;
  }
  if (patch?.lines.percent === 100) return "You're covered — every changed line is tested.";
  if (summary.lines.percent === 100) return "You're covered — the whole project is at 100%.";
  return "You're covered.";
}

/** The sticky PR comment. One table, plain words, no dashboards. */
export function renderComment(input: CommentInput): string {
  const { summary, patch, thresholds, result } = input;
  const lines: string[] = [COMMENT_MARKER, "", "## 🦘 Covallaby", "", headline(input), ""];

  lines.push("| Metric | Result |");
  lines.push("|---|---|");
  lines.push(`| Project coverage | ${formatPercent(summary.lines.percent)} |`);
  if (patch && patch.lines.percent !== null) {
    lines.push(`| Patch coverage | ${formatPercent(patch.lines.percent)} |`);
  }
  const required: string[] = [];
  if (thresholds.minProject !== undefined) {
    required.push(`project ${formatPercent(thresholds.minProject)}`);
  }
  if (thresholds.minPatch !== undefined)
    required.push(`patch ${formatPercent(thresholds.minPatch)}`);
  if (thresholds.minNewFile !== undefined) {
    required.push(`new files ${formatPercent(thresholds.minNewFile)}`);
  }
  if (required.length > 0) lines.push(`| Required | ${required.join(", ")} |`);
  lines.push("");

  if (!result.ok) {
    for (const failure of result.failures) {
      lines.push(`> ⚠️ ${failure.message}`);
    }
    lines.push("");
  }

  const spots = (patch?.files ?? []).filter((f) => f.uncovered.length > 0);
  if (spots.length > 0) {
    const total = spots.reduce(
      (n, f) => n + f.uncovered.reduce((m, [lo, hi]) => m + hi - lo + 1, 0),
      0,
    );
    lines.push(
      `${total === 1 ? "Only 1 changed line needs" : `${total} changed lines need`} some love:`,
    );
    lines.push("");
    for (const file of spots.slice(0, 10)) {
      lines.push(`- \`${file.path}:${formatRanges(file.uncovered)}\``);
    }
    if (spots.length > 10) lines.push(`- …and ${spots.length - 10} more files`);
    lines.push("");
  } else if (patch && patch.lines.percent !== null && result.ok) {
    lines.push("Nice jump! Every changed line that can be tested, is. 🎉");
    lines.push("");
  }

  lines.push(...renderBreakdown(summary, patch));

  lines.push(
    `<sub>${summary.lines.covered} of ${summary.lines.total} lines covered across ${summary.totalFiles} files · [Covallaby](https://github.com/covallaby/covallaby)</sub>`,
  );
  return lines.join("\n");
}

const BREAKDOWN_ROWS = 20;

/** Collapsed-by-default per-file and per-directory tables. */
function renderBreakdown(summary: ReportSummary, patch: PatchSummary | null): string[] {
  const lines: string[] = [];

  const changed = (patch?.files ?? []).filter((f) => f.lines.total > 0);
  if (changed.length > 0) {
    const rows = [...changed].sort((a, b) => (a.lines.percent ?? 101) - (b.lines.percent ?? 101));
    lines.push("<details>");
    lines.push(`<summary>Changed files (${rows.length})</summary>`);
    lines.push("");
    lines.push("| File | Patch | Missing |");
    lines.push("|---|---|---|");
    for (const f of rows.slice(0, BREAKDOWN_ROWS)) {
      const missing = f.uncovered.length > 0 ? `\`${formatRanges(f.uncovered)}\`` : "—";
      lines.push(`| \`${f.path}\` | ${formatPercent(f.lines.percent)} | ${missing} |`);
    }
    if (rows.length > BREAKDOWN_ROWS) {
      lines.push(`| …and ${rows.length - BREAKDOWN_ROWS} more | | |`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  const dirs = rollupByDirectory(summary);
  if (dirs.length > 1) {
    lines.push("<details>");
    lines.push(`<summary>Project by directory (${dirs.length})</summary>`);
    lines.push("");
    lines.push("| Directory | Lines | Coverage |");
    lines.push("|---|---|---|");
    for (const d of dirs.slice(0, BREAKDOWN_ROWS)) {
      lines.push(
        `| \`${d.path}/\` | ${d.lines.covered}/${d.lines.total} | ${formatPercent(d.lines.percent)} |`,
      );
    }
    if (dirs.length > BREAKDOWN_ROWS) {
      lines.push(`| …and ${dirs.length - BREAKDOWN_ROWS} more | | |`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  return lines;
}

/** The GitHub Step Summary — same content, no marker. */
export function renderStepSummary(input: CommentInput): string {
  return renderComment(input).replace(`${COMMENT_MARKER}\n\n`, "");
}
