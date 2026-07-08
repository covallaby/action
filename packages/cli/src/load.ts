import { readFileSync } from "node:fs";
import { type CoverageReport, mergeReports } from "@covallaby/core";
import { type CoverageFormat, parseCoverage } from "@covallaby/parsers";

export interface LoadOptions {
  format?: CoverageFormat;
  stripPrefix?: string;
}

/** Read, parse, and merge one or more coverage files into a single report. */
export function loadReports(paths: string[], options: LoadOptions = {}): CoverageReport {
  const reports = paths.map((path) => {
    let content: string;
    try {
      content = readFileSync(path, "utf8");
    } catch {
      throw new Error(
        `Couldn't read "${path}". Run your tests with coverage first, then point Covallaby at the output (e.g. coverage/lcov.info).`,
      );
    }
    return parseCoverage(content, options);
  });
  return reports.length === 1 ? reports[0]! : mergeReports(reports);
}
