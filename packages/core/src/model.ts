/**
 * The shared coverage model every parser normalizes into.
 * See docs/design/coverage-model.md for the reasoning.
 */

export interface LineCoverage {
  /** 1-based line number. */
  line: number;
  /** Execution count. 0 means uncovered. */
  hits: number;
}

export interface FunctionCoverage {
  name: string;
  /** 1-based line where the function starts. */
  line: number;
  hits: number;
}

export interface BranchCoverage {
  /** 1-based line the branch point lives on. */
  line: number;
  /** Branches taken at this point. */
  taken: number;
  /** Total branches at this point. */
  total: number;
}

export interface FileCoverage {
  /** Repo-relative path with POSIX separators. */
  path: string;
  /** Sorted ascending by line, one entry per executable line. */
  lines: LineCoverage[];
  functions: FunctionCoverage[];
  branches: BranchCoverage[];
}

export interface CoverageReport {
  files: FileCoverage[];
}

export interface Counter {
  covered: number;
  total: number;
  /** 0–100, or null when total is 0 (e.g. no branches reported). */
  percent: number | null;
}

export interface Summary {
  lines: Counter;
  functions: Counter;
  branches: Counter;
}

export interface FileSummary extends Summary {
  path: string;
}

export interface ReportSummary extends Summary {
  files: FileSummary[];
  totalFiles: number;
}

function percent(covered: number, total: number): number | null {
  if (total === 0) return null;
  return (covered / total) * 100;
}

function counter(covered: number, total: number): Counter {
  return { covered, total, percent: percent(covered, total) };
}

export function summarizeFile(file: FileCoverage): FileSummary {
  const coveredLines = file.lines.filter((l) => l.hits > 0).length;
  const coveredFunctions = file.functions.filter((f) => f.hits > 0).length;
  let branchesTaken = 0;
  let branchesTotal = 0;
  for (const b of file.branches) {
    branchesTaken += b.taken;
    branchesTotal += b.total;
  }
  return {
    path: file.path,
    lines: counter(coveredLines, file.lines.length),
    functions: counter(coveredFunctions, file.functions.length),
    branches: counter(branchesTaken, branchesTotal),
  };
}

export function summarize(report: CoverageReport): ReportSummary {
  const files = report.files.map(summarizeFile);
  const sum = (pick: (f: FileSummary) => Counter): Counter => {
    let covered = 0;
    let total = 0;
    for (const f of files) {
      covered += pick(f).covered;
      total += pick(f).total;
    }
    return counter(covered, total);
  };
  return {
    files,
    totalFiles: files.length,
    lines: sum((f) => f.lines),
    functions: sum((f) => f.functions),
    branches: sum((f) => f.branches),
  };
}

/**
 * Uncovered lines of a file, collapsed into ranges: [[44, 45], [88, 88]].
 * Powers friendly callouts like "src/payment.ts:44-45".
 */
export function uncoveredRanges(file: FileCoverage): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const { line, hits } of file.lines) {
    if (hits > 0) continue;
    const last = ranges[ranges.length - 1];
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      ranges.push([line, line]);
    }
  }
  return ranges;
}

export function formatRanges(ranges: Array<[number, number]>): string {
  return ranges.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", ");
}

/** Merge reports (e.g. from parallel test shards). Line hits are summed. */
export function mergeReports(reports: CoverageReport[]): CoverageReport {
  const byPath = new Map<string, FileCoverage>();
  for (const report of reports) {
    for (const file of report.files) {
      const existing = byPath.get(file.path);
      if (!existing) {
        byPath.set(file.path, {
          path: file.path,
          lines: file.lines.map((l) => ({ ...l })),
          functions: file.functions.map((f) => ({ ...f })),
          branches: file.branches.map((b) => ({ ...b })),
        });
        continue;
      }
      mergeInto(existing, file);
    }
  }
  return { files: [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path)) };
}

function mergeInto(target: FileCoverage, source: FileCoverage): void {
  const lineHits = new Map(target.lines.map((l) => [l.line, l]));
  for (const l of source.lines) {
    const existing = lineHits.get(l.line);
    if (existing) {
      existing.hits += l.hits;
    } else {
      const entry = { ...l };
      target.lines.push(entry);
      lineHits.set(l.line, entry);
    }
  }
  target.lines.sort((a, b) => a.line - b.line);

  const fnKey = (f: FunctionCoverage) => `${f.name}@${f.line}`;
  const fns = new Map(target.functions.map((f) => [fnKey(f), f]));
  for (const f of source.functions) {
    const existing = fns.get(fnKey(f));
    if (existing) {
      existing.hits += f.hits;
    } else {
      const entry = { ...f };
      target.functions.push(entry);
      fns.set(fnKey(f), entry);
    }
  }

  const branches = new Map(target.branches.map((b) => [b.line, b]));
  for (const b of source.branches) {
    const existing = branches.get(b.line);
    if (existing) {
      // Best effort: branch identity is per line; take the max taken/total.
      existing.taken = Math.max(existing.taken, b.taken);
      existing.total = Math.max(existing.total, b.total);
    } else {
      const entry = { ...b };
      target.branches.push(entry);
      branches.set(b.line, entry);
    }
  }
  target.branches.sort((a, b) => a.line - b.line);
}

/** True when every coverable unit in the counter was hit. */
export function isFullyCovered(counter: Counter): boolean {
  return counter.total > 0 && counter.covered === counter.total;
}
