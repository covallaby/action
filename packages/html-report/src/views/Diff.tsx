import { type PatchSummary, formatRanges } from "@covallaby/core";
import { EmptyState, PercentCell, StatTile } from "../components.js";

export function Diff({ patch }: { patch: PatchSummary | null }) {
  if (!patch) {
    return (
      <EmptyState
        title="No diff data"
        body="Generate the report with --diff <patch-file> to see coverage of changed lines."
      />
    );
  }
  if (patch.files.length === 0) {
    return (
      <EmptyState
        title="Nothing coverable changed"
        body="The diff doesn't touch any executable lines — docs and config changes don't need tests."
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Patch coverage"
          percent={patch.lines.percent}
          detail={`${patch.lines.covered} of ${patch.lines.total} changed lines`}
        />
      </div>
      <div className="mt-8 rounded-xl border border-(--border) bg-(--surface)">
        <table className="w-full text-sm">
          <tbody>
            {patch.files.map((f) => (
              <tr key={f.path} className="border-b border-(--hairline) last:border-b-0">
                <td className="px-4 py-2.5">
                  <a href={`#/file/${encodeURIComponent(f.path)}`} className="mono hover:underline">
                    {f.path}
                  </a>
                  {f.added ? (
                    <span className="ml-2 rounded bg-(--status-good-track) px-1.5 py-0.5 text-[10px] text-(--ink-secondary)">
                      new file
                    </span>
                  ) : null}
                </td>
                <td className="mono max-w-xs px-2 py-2.5 text-right text-xs text-(--ink-secondary)">
                  {f.uncovered.length > 0 ? formatRanges(f.uncovered) : ""}
                </td>
                <td className="w-52 px-4 py-2.5">
                  <PercentCell percent={f.lines.percent} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
