import { type Counter, type CoverageReport, type FileCoverage, formatRanges } from "./model.js";

/** A file changed in a PR, with the line numbers added or modified. */
export interface ChangedFile {
  /** Repo-relative POSIX path (matches the coverage model). */
  path: string;
  /** True when the file is new in this PR. */
  added: boolean;
  /** 1-based line numbers that are new or modified, ascending. */
  lines: number[];
}

export interface PatchFileSummary {
  path: string;
  added: boolean;
  /** Coverage of the changed, coverable lines in this file. */
  lines: Counter;
  /** Changed lines that are coverable but uncovered, as collapsed ranges. */
  uncovered: Array<[number, number]>;
}

export interface PatchSummary {
  lines: Counter;
  files: PatchFileSummary[];
}

function counter(covered: number, total: number): Counter {
  return { covered, total, percent: total === 0 ? null : (covered / total) * 100 };
}

/**
 * Patch coverage: of the lines this PR touched, how many did tests hit?
 * A changed line only counts if the coverage report knows it's executable —
 * comments and blank lines never drag the number down.
 */
/**
 * Match a PR-diff path (always repo-relative) to a coverage file. Coverage
 * tools often emit shorter paths than the repo: JaCoCo reports
 * `com/example/Payment.java` for `src/main/java/com/example/Payment.java`, and
 * Cobertura with `--cov=pkg` drops the source root. So after an exact match we
 * fall back to a segment-anchored suffix match, but only when it's
 * unambiguous — one coverage file left whose path is a suffix of the diff path.
 * A coverage entry is consumed once matched, so it can't attach to two files.
 */
export function matchCoveragePaths(
  reportPaths: string[],
  changedPaths: string[],
): Map<string, string> {
  const result = new Map<string, string>();
  const available = new Set(reportPaths);
  const exact = new Set(reportPaths);

  // Pass 1: exact matches (unambiguous by definition).
  for (const d of changedPaths) {
    if (exact.has(d)) {
      result.set(d, d);
      available.delete(d);
    }
  }
  // Pass 2: suffix fallback for the rest, longest diff paths first so the most
  // specific claims its coverage entry before a shorter, vaguer one.
  const remaining = changedPaths.filter((d) => !result.has(d)).sort((a, b) => b.length - a.length);
  for (const d of remaining) {
    const candidates = [...available].filter((c) => d === c || d.endsWith(`/${c}`));
    if (candidates.length === 1) {
      const c = candidates[0]!;
      result.set(d, c);
      available.delete(c);
    }
    // zero or ambiguous (>1): leave unmatched rather than risk wrong attribution
  }
  return result;
}

export function computePatchCoverage(report: CoverageReport, changed: ChangedFile[]): PatchSummary {
  const byPath = new Map<string, FileCoverage>(report.files.map((f) => [f.path, f]));
  const matched = matchCoveragePaths(
    report.files.map((f) => f.path),
    changed.map((c) => c.path),
  );
  const files: PatchFileSummary[] = [];

  for (const change of changed) {
    const coveragePath = matched.get(change.path);
    const coverage = coveragePath ? byPath.get(coveragePath) : undefined;
    if (!coverage) continue; // not a covered file (docs, config, …)
    const hitsByLine = new Map(coverage.lines.map((l) => [l.line, l.hits]));

    let covered = 0;
    let total = 0;
    const uncovered: Array<[number, number]> = [];
    for (const line of change.lines) {
      const hits = hitsByLine.get(line);
      if (hits === undefined) continue; // not executable
      total += 1;
      if (hits > 0) {
        covered += 1;
      } else {
        const last = uncovered[uncovered.length - 1];
        if (last && line === last[1] + 1) {
          last[1] = line;
        } else {
          uncovered.push([line, line]);
        }
      }
    }
    if (total > 0) {
      files.push({
        path: change.path,
        added: change.added,
        lines: counter(covered, total),
        uncovered,
      });
    }
  }

  const totals = counter(
    files.reduce((n, f) => n + f.lines.covered, 0),
    files.reduce((n, f) => n + f.lines.total, 0),
  );
  return { lines: totals, files };
}

/**
 * Extract the new-side line numbers touched by a unified-diff patch body
 * (the `@@ …` hunks of a single file, as returned by GitHub's listFiles API).
 */
export function parseHunks(patch: string): number[] {
  const lines: number[] = [];
  let newLine = 0;
  for (const row of patch.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (row.startsWith("+")) {
      lines.push(newLine);
      newLine += 1;
    } else if (row.startsWith("-") || row.startsWith("\\")) {
      // deletion or "\ No newline at end of file": new-side line number unchanged
    } else {
      newLine += 1; // context line
    }
  }
  return lines;
}

/** Parse a full multi-file unified diff (e.g. `git diff` output). */
export function parseUnifiedDiff(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  let current: ChangedFile | null = null;
  let newLine = 0;

  for (const row of diff.split("\n")) {
    if (row.startsWith("diff --git ")) {
      current = null; // wait for +++ to learn the new path
      continue;
    }
    if (row.startsWith("+++ ")) {
      const raw = row.slice(4).trim();
      if (raw === "/dev/null") {
        current = null; // file deleted
        continue;
      }
      current = { path: raw.replace(/^b\//, ""), added: false, lines: [] };
      files.push(current);
      continue;
    }
    if (row.startsWith("--- ") && row.includes("/dev/null")) {
      // new file; the +++ line follows and creates `current`
      continue;
    }
    if (current === null) continue;

    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
    if (hunk) {
      newLine = Number(hunk[2]);
      if (hunk[1] === "0") current.added = true; // -0,0 → file is new
      continue;
    }
    if (row.startsWith("+++") || row.startsWith("---")) continue;
    if (row.startsWith("+")) {
      current.lines.push(newLine);
      newLine += 1;
    } else if (row.startsWith("-") || row.startsWith("\\")) {
      // new-side line number unchanged
    } else if (row.startsWith(" ") || row === "") {
      newLine += 1;
    }
  }
  return files.filter((f) => f.lines.length > 0 || f.added);
}

export { formatRanges };
