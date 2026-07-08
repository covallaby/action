import type { Counter } from "./model.js";

/** Direction of coverage movement between two runs. */
export type Trend = "up" | "down" | "flat";

export function coverageTrend(before: Counter, after: Counter): Trend {
  const a = before.percent ?? 0;
  const b = after.percent ?? 0;
  if (b > a) return "up";
  if (b < a) return "down";
  return "flat";
}

/** A friendly one-liner about the trend. */
export function describeTrend(trend: Trend): string {
  if (trend === "up") return "Nice jump! Coverage improved.";
  if (trend === "down") return "Coverage slipped a little.";
  return "Coverage held steady.";
}
