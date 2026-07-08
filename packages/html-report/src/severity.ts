/**
 * Coverage state -> status color, per the reserved status palette.
 * The percentage text always sits next to the meter, so color never
 * carries the value alone.
 */
export type Severity = "good" | "warning" | "serious" | "critical" | "none";

export function severity(percent: number | null): Severity {
  if (percent === null) return "none";
  if (percent >= 90) return "good";
  if (percent >= 75) return "warning";
  if (percent >= 50) return "serious";
  return "critical";
}

/** CSS custom-property names; values are defined per theme in styles.css. */
export const severityVars: Record<Severity, { fill: string; track: string }> = {
  good: { fill: "var(--status-good)", track: "var(--status-good-track)" },
  warning: { fill: "var(--status-warning)", track: "var(--status-warning-track)" },
  serious: { fill: "var(--status-serious)", track: "var(--status-serious-track)" },
  critical: { fill: "var(--status-critical)", track: "var(--status-critical-track)" },
  none: { fill: "var(--ink-muted)", track: "var(--hairline)" },
};
