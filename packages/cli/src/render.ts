import {
  type CoverageReport,
  type ReportSummary,
  formatPercent,
  formatRanges,
  summarize,
  uncoveredRanges,
} from "@covallaby/core";
import pc from "picocolors";

const color = {
  good: pc.green,
  ok: pc.yellow,
  bad: pc.red,
  dim: pc.dim,
  bold: pc.bold,
};

function coloredPercent(percent: number | null): string {
  const text = formatPercent(percent);
  if (percent === null) return color.dim(text);
  if (percent >= 90) return color.good(text);
  if (percent >= 75) return color.ok(text);
  return color.bad(text);
}

/** The human-facing `covallaby report` output. Friendly, brief, actionable. */
export function renderReport(report: CoverageReport, summary: ReportSummary): string {
  const out: string[] = [];
  out.push("");
  out.push(`  ${color.bold("🦘 Covallaby")}`);
  out.push("");
  out.push(`  Project coverage   ${coloredPercent(summary.lines.percent)}`);
  if (summary.functions.total > 0) {
    out.push(`  Functions          ${coloredPercent(summary.functions.percent)}`);
  }
  if (summary.branches.total > 0) {
    out.push(`  Branches           ${coloredPercent(summary.branches.percent)}`);
  }
  out.push(
    color.dim(
      `  ${summary.lines.covered} of ${summary.lines.total} lines covered across ${summary.totalFiles} ${summary.totalFiles === 1 ? "file" : "files"}`,
    ),
  );

  const needsLove = report.files
    .map((file) => ({ file, ranges: uncoveredRanges(file) }))
    .filter(({ ranges }) => ranges.length > 0)
    .sort(
      (a, b) =>
        b.ranges.reduce((n, [lo, hi]) => n + hi - lo + 1, 0) -
        a.ranges.reduce((n, [lo, hi]) => n + hi - lo + 1, 0),
    );

  out.push("");
  if (needsLove.length === 0) {
    out.push(`  ${color.good("You're covered — every line was hit.")}`);
  } else {
    const shown = needsLove.slice(0, 5);
    const totalUncovered = summary.lines.total - summary.lines.covered;
    out.push(
      `  ${totalUncovered} uncovered ${totalUncovered === 1 ? "line needs" : "lines need"} some love:`,
    );
    for (const { file, ranges } of shown) {
      out.push(`    ${file.path}${color.dim(`:${formatRanges(ranges)}`)}`);
    }
    if (needsLove.length > shown.length) {
      out.push(color.dim(`    …and ${needsLove.length - shown.length} more files`));
    }
  }
  out.push("");
  return out.join("\n");
}

/** Stable machine-readable shape shared by `report --json` and `check --json`. */
export function reportJson(summary: ReportSummary) {
  return {
    lines: summary.lines,
    functions: summary.functions,
    branches: summary.branches,
    totalFiles: summary.totalFiles,
    files: summary.files,
  };
}

export { formatPercent, summarize };
