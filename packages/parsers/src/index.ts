import type { CoverageReport } from "@covallaby/core";
import { ParseError, parseLcov } from "./lcov.js";

export { ParseError, parseLcov } from "./lcov.js";
export { normalizePath } from "./paths.js";

export type CoverageFormat = "lcov";

export interface ParseOptions {
  /** Force a format instead of detecting from content. */
  format?: CoverageFormat;
  /** Path prefix to strip so paths become repo-relative. */
  stripPrefix?: string;
}

/** Best-effort format detection. More formats land in Milestone 5. */
export function detectFormat(content: string): CoverageFormat | null {
  if (/^(TN:|SF:)/m.test(content)) return "lcov";
  return null;
}

export function parseCoverage(content: string, options: ParseOptions = {}): CoverageReport {
  const format = options.format ?? detectFormat(content);
  if (format === null) {
    throw new ParseError(
      "Couldn't detect the coverage format. Covallaby currently understands LCOV (coverage/lcov.info); JaCoCo, Cobertura, and xccov are coming soon.",
    );
  }
  const stripPrefix = options.stripPrefix;
  return parseLcov(content, stripPrefix === undefined ? {} : { stripPrefix });
}
