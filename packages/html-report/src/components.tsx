import { formatPercent } from "@covallaby/core";
import { severity, severityVars } from "./severity.js";

/** Stat tile: label, semibold value, optional footnote. Proportional figures. */
export function StatTile({
  label,
  percent,
  detail,
}: {
  label: string;
  percent: number | null;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-(--border) bg-(--surface) px-5 py-4">
      <div className="text-sm text-(--ink-secondary)">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{formatPercent(percent)}</div>
      {detail ? <div className="mt-1 text-xs text-(--ink-muted)">{detail}</div> : null}
      <Meter percent={percent} className="mt-3" />
    </div>
  );
}

/** Meter: fill carries severity; the track is a lighter step of the same ramp. */
export function Meter({ percent, className = "" }: { percent: number | null; className?: string }) {
  const s = severity(percent);
  const vars = severityVars[s];
  const width = percent === null ? 0 : Math.max(percent, 1.5);
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full ${className}`}
      style={{ background: vars.track }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? undefined}
      aria-label={`coverage ${formatPercent(percent)}`}
    >
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: vars.fill }} />
    </div>
  );
}

/** Percent as text (text tokens, never the status color) + a small meter. */
export function PercentCell({ percent }: { percent: number | null }) {
  return (
    <div className="flex items-center justify-end gap-3">
      <span className="tabular-nums text-sm text-(--ink-secondary)">{formatPercent(percent)}</span>
      <div className="w-24 shrink-0">
        <Meter percent={percent} />
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-(--border) bg-(--surface) px-6 py-10 text-center">
      <div className="text-base font-medium">{title}</div>
      <div className="mt-1 text-sm text-(--ink-secondary)">{body}</div>
    </div>
  );
}
