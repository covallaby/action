import { type CoverageReport, formatRanges, uncoveredRanges } from "@covallaby/core";
import { useMemo } from "react";
import { EmptyState } from "../components.js";

export function Missing({ report }: { report: CoverageReport }) {
  const missing = useMemo(
    () =>
      report.files
        .map((file) => ({ path: file.path, ranges: uncoveredRanges(file) }))
        .filter((f) => f.ranges.length > 0)
        .map((f) => ({
          ...f,
          count: f.ranges.reduce((n, [lo, hi]) => n + hi - lo + 1, 0),
        }))
        .sort((a, b) => b.count - a.count),
    [report],
  );

  if (missing.length === 0) {
    return (
      <EmptyState
        title="You're covered 🎉"
        body="Every coverable line in this report was hit. Nothing to see here."
      />
    );
  }

  const total = missing.reduce((n, f) => n + f.count, 0);

  return (
    <div>
      <p className="mb-4 text-sm text-(--ink-secondary)">
        {total} uncovered {total === 1 ? "line" : "lines"} across {missing.length}{" "}
        {missing.length === 1 ? "file" : "files"}, most-missed first.
      </p>
      <div className="rounded-xl border border-(--border) bg-(--surface)">
        <table className="w-full text-sm">
          <tbody>
            {missing.map((f) => (
              <tr key={f.path} className="border-b border-(--hairline) last:border-b-0">
                <td className="px-4 py-2.5 align-top">
                  <a href={`#/file/${encodeURIComponent(f.path)}`} className="mono hover:underline">
                    {f.path}
                  </a>
                </td>
                <td className="w-24 px-2 py-2.5 text-right align-top tabular-nums text-(--ink-muted)">
                  {f.count} missed
                </td>
                <td className="mono max-w-md px-4 py-2.5 text-right text-xs text-(--ink-secondary)">
                  {formatRanges(f.ranges)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
