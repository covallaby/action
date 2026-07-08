# Design: The Coverage Model

Status: **Accepted** · Milestone 2

Every parser (LCOV, JaCoCo, Cobertura, xccov) normalizes into one shared model
that lives in `@covallaby/core`. Everything downstream — CLI output, PR
comments, HTML reports, badges, diffs — consumes only this model and never
touches raw coverage formats.

## Goals

- JSON-serializable (the model *is* the machine-readable output of `covallaby report --json`).
- Rich enough for patch coverage and line-level "needs attention" callouts.
- Small enough that a new parser can be written in an afternoon.

## The model

```ts
interface CoverageReport {
  files: FileCoverage[];
}

interface FileCoverage {
  /** Repo-relative path with POSIX separators. */
  path: string;
  /** Executable lines and how often each was hit. */
  lines: LineCoverage[];      // { line, hits }
  /** Optional: not every format reports these. */
  functions: FunctionCoverage[]; // { name, line, hits }
  branches: BranchCoverage[];    // { line, taken, total }
}
```

Derived data (never stored, always computed by `core`):

- `summarize(report)` → covered/total/percent for lines, functions, branches,
  per file and for the whole project.
- `uncoveredLines(file)` → collapsed ranges like `44-45, 88` for friendly output.

## Decisions & tradeoffs

**Line hits as an array, not a map.** `{ line, hits }[]` is JSON-friendly,
diff-friendly, and keeps the model free of `Map` (which doesn't serialize).
Parsers must emit lines sorted ascending and deduplicated; `core` validates
this cheaply instead of re-sorting on every read.

**Branches are simplified to `taken/total` per line.** LCOV's
block/branch-number detail and JaCoCo's counters both collapse cleanly into
"on line 12, 3 of 4 branches taken", which is exactly what humans need.
We deliberately drop per-branch identity — no consumer needs it, and keeping
it would leak format-specific concepts into the shared model.

**Percentages are computed, never parsed.** Formats disagree on rounding.
We compute from raw counts in one place so every surface shows the same number.

**Paths are normalized at parse time.** Parsers strip a configurable prefix
and convert to POSIX separators, so the model can be matched against `git diff`
paths for patch coverage later.

## Rejected alternatives

- **Per-statement/region coverage (xccov style) as the base unit.** Lines are
  the common denominator across all four formats; regions can't be
  reconstructed from LCOV/Cobertura, so lines it is.
- **Storing summaries in the model.** Redundant state that can drift.
  Summaries are cheap to compute.
