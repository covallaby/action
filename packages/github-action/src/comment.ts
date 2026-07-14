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

/**
 * Make an untrusted file path safe inside a markdown inline-code span / table
 * cell: backticks would break out of the span, pipes break the table, and
 * newlines break the row. Coverage-file paths are attacker-controlled.
 */
function codePath(path: string): string {
  return path
    .replaceAll("`", "'")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]+/g, " ");
}

export interface CommentInput {
  summary: ReportSummary;
  patch: PatchSummary | null;
  thresholds: Thresholds;
  result: CheckResult;
  /** Directory-rollup depth: "auto" (default), a number, or "off". */
  breakdown?: number | "auto" | "off";
  /** Dashboard page for this commit's coverage upload — deep-links the numbers. */
  coverage?: { url: string };
  playback?: { url: string; artifacts: number };
  storybook?: { url: string; files: number; captures?: number };
}

/**
 * Row budgets differ by surface: a PR comment lives in the conversation and
 * must stay compact; the Step Summary and check-run page are dedicated
 * report pages with room for the full table.
 */
const COMMENT_ROWS = 20;
const REPORT_PAGE_ROWS = 200;

function headline({ result, patch, summary }: CommentInput): string {
  if (summary.totalFiles === 0) return "Your visual test artifacts are ready.";
  if (!result.ok) {
    const n = result.failures.length;
    return `${n === 1 ? "One thing" : `${n} things`} to look at before merging.`;
  }
  if (patch?.lines.percent === 100) return "You're covered — every changed line is tested.";
  if (summary.lines.percent === 100) return "You're covered — the whole project is at 100%.";
  return "You're covered.";
}

/** The sticky PR comment. One table, plain words, no dashboards. */
export function renderComment(input: CommentInput, maxRows: number = COMMENT_ROWS): string {
  const { summary, patch, thresholds, result } = input;
  const lines: string[] = [COMMENT_MARKER, "", "## 🦘 Covallaby", "", headline(input), ""];

  // When the report lives on a Covallaby server, the numbers link straight
  // to the commit's coverage page — the same target as the commit statuses.
  const linked = (text: string) => (input.coverage ? `[${text}](${input.coverage.url})` : text);

  if (summary.totalFiles > 0) {
    lines.push("| Metric | Result |");
    lines.push("|---|---|");
    lines.push(`| Project coverage | ${linked(formatPercent(summary.lines.percent))} |`);
    if (patch && patch.lines.percent !== null) {
      lines.push(`| Patch coverage | ${linked(formatPercent(patch.lines.percent))} |`);
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
  }

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
      lines.push(`- ${linked(`\`${codePath(file.path)}:${formatRanges(file.uncovered)}\``)}`);
    }
    if (spots.length > 10) lines.push(`- …and ${spots.length - 10} more files`);
    lines.push("");
  } else if (patch && patch.lines.percent !== null && result.ok) {
    lines.push("Nice jump! Every changed line that can be tested, is. 🎉");
    lines.push("");
  }

  lines.push(...renderBreakdown(summary, patch, input.breakdown ?? "auto", maxRows));

  if (input.playback) {
    lines.push("### Browser playback");
    lines.push("");
    lines.push(
      `[Watch this run in Covallaby](${input.playback.url}) · ${input.playback.artifacts} artifacts`,
    );
    lines.push("");
  }

  if (input.storybook) {
    lines.push("### Storybook preview");
    lines.push("");
    lines.push(
      input.storybook.captures
        ? `[Review ${input.storybook.captures} component captures and visual diffs in Covallaby](${input.storybook.url})`
        : `[Explore this build in Covallaby](${input.storybook.url}) · ${input.storybook.files} files`,
    );
    lines.push("");
  }

  lines.push(
    summary.totalFiles > 0
      ? `<sub>${summary.lines.covered} of ${summary.lines.total} lines covered across ${summary.totalFiles} files · [Covallaby](https://github.com/covallaby/action)</sub>`
      : "<sub>Visual testing powered by [Covallaby](https://github.com/covallaby/action)</sub>",
  );
  return lines.join("\n");
}

/** Collapsed-by-default per-file and per-directory tables. */
function renderBreakdown(
  summary: ReportSummary,
  patch: PatchSummary | null,
  breakdown: number | "auto" | "off",
  maxRows: number,
): string[] {
  const lines: string[] = [];

  const changed = (patch?.files ?? []).filter((f) => f.lines.total > 0);
  if (changed.length > 0) {
    const rows = [...changed].sort((a, b) => (a.lines.percent ?? 101) - (b.lines.percent ?? 101));
    lines.push("<details>");
    lines.push(`<summary>Changed files (${rows.length})</summary>`);
    lines.push("");
    lines.push("| File | Patch | Missing |");
    lines.push("|---|---|---|");
    for (const f of rows.slice(0, maxRows)) {
      const missing = f.uncovered.length > 0 ? `\`${formatRanges(f.uncovered)}\`` : "—";
      lines.push(`| \`${codePath(f.path)}\` | ${formatPercent(f.lines.percent)} | ${missing} |`);
    }
    if (rows.length > maxRows) {
      lines.push(`| …and ${rows.length - maxRows} more | | |`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  if (breakdown === "off") return lines;

  const dirs = rollupByDirectory(summary, {
    maxRows,
    ...(breakdown !== "auto" && { depth: breakdown }),
  });
  if (dirs.length > 1) {
    lines.push("<details>");
    lines.push(`<summary>Project by directory (${dirs.length})</summary>`);
    lines.push("");
    lines.push("| Directory | Lines | Coverage |");
    lines.push("|---|---|---|");
    for (const d of dirs.slice(0, maxRows)) {
      lines.push(
        `| \`${codePath(d.path)}/\` | ${d.lines.covered}/${d.lines.total} | ${formatPercent(d.lines.percent)} |`,
      );
    }
    if (dirs.length > maxRows) {
      lines.push(`| …and ${dirs.length - maxRows} more | | |`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  return lines;
}

/** The Step Summary / check-run body — same content, no marker, full tables. */
export function renderStepSummary(input: CommentInput): string {
  return renderComment(input, REPORT_PAGE_ROWS).replace(`${COMMENT_MARKER}\n\n`, "");
}
