import {
  type CoverageReport,
  type PatchSummary,
  type ReportSummary,
  uncoveredRanges,
} from "@covallaby/core";
import { useMemo, useState } from "react";
import { PercentCell, StatTile } from "../components.js";

export function Overview({
  report,
  summary,
  patch,
}: {
  report: CoverageReport;
  summary: ReportSummary;
  patch: PatchSummary | null;
}) {
  const [query, setQuery] = useState("");

  const uncoveredByPath = useMemo(() => {
    const map = new Map<string, number>();
    for (const file of report.files) {
      map.set(
        file.path,
        uncoveredRanges(file).reduce((n, [lo, hi]) => n + hi - lo + 1, 0),
      );
    }
    return map;
  }, [report]);

  const files = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? summary.files.filter((f) => f.path.toLowerCase().includes(q)) : summary.files;
    // Lowest coverage first: that's what needs attention.
    return [...list].sort((a, b) => (a.lines.percent ?? 101) - (b.lines.percent ?? 101));
  }, [summary, query]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Project coverage"
          percent={summary.lines.percent}
          detail={`${summary.lines.covered} of ${summary.lines.total} lines`}
        />
        {patch && patch.lines.percent !== null ? (
          <StatTile
            label="Patch coverage"
            percent={patch.lines.percent}
            detail={`${patch.lines.covered} of ${patch.lines.total} changed lines`}
          />
        ) : null}
        {summary.functions.total > 0 ? (
          <StatTile
            label="Functions"
            percent={summary.functions.percent}
            detail={`${summary.functions.covered} of ${summary.functions.total}`}
          />
        ) : null}
        {summary.branches.total > 0 ? (
          <StatTile
            label="Branches"
            percent={summary.branches.percent}
            detail={`${summary.branches.covered} of ${summary.branches.total}`}
          />
        ) : null}
      </div>

      <div className="mt-8 rounded-xl border border-(--border) bg-(--surface)">
        <div className="flex items-center justify-between gap-4 border-b border-(--hairline) px-4 py-3">
          <div className="text-sm font-medium">
            Files <span className="text-(--ink-muted)">({files.length})</span>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter files…"
            className="w-64 rounded-lg border border-(--border) bg-(--page) px-3 py-1.5 text-sm outline-none placeholder:text-(--ink-muted) focus:border-(--ink-muted)"
          />
        </div>
        <table className="w-full text-sm">
          <tbody>
            {files.map((file) => (
              <tr key={file.path} className="border-b border-(--hairline) last:border-b-0">
                <td className="px-4 py-2.5">
                  <a
                    href={`#/file/${encodeURIComponent(file.path)}`}
                    className="mono hover:underline"
                  >
                    {file.path}
                  </a>
                </td>
                <td className="w-28 px-2 py-2.5 text-right tabular-nums text-(--ink-muted)">
                  {uncoveredByPath.get(file.path) ? (
                    <span>{uncoveredByPath.get(file.path)} missed</span>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td className="w-52 px-4 py-2.5">
                  <PercentCell percent={file.lines.percent} />
                </td>
              </tr>
            ))}
            {files.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-(--ink-muted)">
                  No files match "{query}".
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
