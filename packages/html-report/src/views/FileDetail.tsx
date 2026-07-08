import { type FileCoverage, formatRanges, summarizeFile, uncoveredRanges } from "@covallaby/core";
import { useMemo } from "react";
import { EmptyState, StatTile } from "../components.js";

export function FileDetail({
  file,
  source,
  path,
}: {
  file: FileCoverage | undefined;
  source: string | undefined;
  path: string;
}) {
  if (!file) {
    return <EmptyState title="File not found" body={`"${path}" isn't in this coverage report.`} />;
  }
  return <FileDetailBody file={file} source={source} />;
}

function FileDetailBody({ file, source }: { file: FileCoverage; source: string | undefined }) {
  const summary = useMemo(() => summarizeFile(file), [file]);
  const ranges = useMemo(() => uncoveredRanges(file), [file]);
  const hits = useMemo(() => new Map(file.lines.map((l) => [l.line, l.hits])), [file]);
  const branchesByLine = useMemo(() => new Map(file.branches.map((b) => [b.line, b])), [file]);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h1 className="mono text-lg font-medium">{file.path}</h1>
        <a href="#/" className="text-sm text-(--ink-secondary) hover:text-(--ink)">
          ← All files
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Line coverage"
          percent={summary.lines.percent}
          detail={`${summary.lines.covered} of ${summary.lines.total} lines`}
        />
        {summary.functions.total > 0 ? (
          <StatTile label="Functions" percent={summary.functions.percent} />
        ) : null}
        {summary.branches.total > 0 ? (
          <StatTile label="Branches" percent={summary.branches.percent} />
        ) : null}
      </div>

      {ranges.length > 0 ? (
        <p className="mt-6 text-sm text-(--ink-secondary)">
          {ranges.reduce((n, [lo, hi]) => n + hi - lo + 1, 0)} uncovered{" "}
          {ranges.length === 1 && ranges[0]![0] === ranges[0]![1] ? "line needs" : "lines need"}{" "}
          some love: <span className="mono">{formatRanges(ranges)}</span>
        </p>
      ) : (
        <p className="mt-6 text-sm text-(--ink-secondary)">
          You're covered — every line in this file was hit.
        </p>
      )}

      {source ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-(--border) bg-(--surface)">
          <table className="w-full border-collapse text-xs leading-5">
            <tbody>
              {source
                .replace(/\n$/, "")
                .split("\n")
                .map((text, i) => {
                  const line = i + 1;
                  const hit = hits.get(line);
                  const branch = branchesByLine.get(line);
                  const uncovered = hit === 0;
                  return (
                    <tr
                      key={line}
                      id={`L${line}`}
                      style={uncovered ? { background: "var(--line-uncovered)" } : undefined}
                    >
                      <td className="mono w-12 select-none px-2 text-right text-(--ink-muted)">
                        {line}
                      </td>
                      <td
                        className="mono w-14 select-none border-r border-(--hairline) px-2 text-right tabular-nums"
                        style={
                          hit !== undefined && hit > 0
                            ? { background: "var(--line-covered-gutter)" }
                            : undefined
                        }
                      >
                        {hit === undefined ? "" : `${hit}×`}
                      </td>
                      <td className="mono whitespace-pre px-3">
                        {text || " "}
                        {branch && branch.taken < branch.total ? (
                          <span className="ml-2 rounded bg-(--status-warning-track) px-1.5 py-0.5 text-[10px] text-(--ink-secondary)">
                            {branch.taken}/{branch.total} branches
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="Source not embedded"
            body="This file wasn't readable when the report was generated, so only line numbers are shown above."
          />
        </div>
      )}
    </div>
  );
}
