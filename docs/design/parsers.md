# Design: Format Parsers

Status: **Accepted** · Milestones 2 (LCOV) and 5 (JaCoCo, Cobertura, xccov)

Every parser normalizes into the shared model (`docs/design/coverage-model.md`)
and follows the same contract:

- Input is the file *content* (string); parsers never touch the filesystem.
- Paths come out repo-relative POSIX via `normalizePath` (+ optional `stripPrefix`).
- Summary numbers in the input (line-rates, counters at file/report level) are
  **ignored** — core recomputes from raw line data so all surfaces agree.
- Malformed input throws `ParseError` with a friendly, specific message.
- Every parser has fixtures that look like real tool output.

## Format notes

**LCOV** — hand-rolled line parser (Milestone 2). The format is line-oriented;
no dependency needed.

**JaCoCo XML** — path is `package@name / sourcefile@name`. Per-line: `ci`
(covered instructions) > 0 means the line was hit; JaCoCo doesn't report
execution counts, so hits are 0/1. Branches per line from `cb`/(`mb`+`cb`).
Functions from `class > method` elements (hit when their METHOD counter has
`covered` > 0), attached to the class's `sourcefilename`.

**Cobertura XML** — path is `class@filename`; multiple `class` elements often
share one filename (nested classes), so the parser merges them. Line hits are
real counts. Branch data parsed from `condition-coverage="50% (1/2)"`.
Functions from `method` elements (first `line` child carries line/hits).

**xccov JSON** — we support the **per-line archive shape**
(`xcrun xccov view --archive --json Result.xcresult`): a map of file path →
`{line, isExecutable, executionCount, subranges?}` records. A partially covered
line reports `executionCount: null` with subranges; we take the max subrange
count. The summary shape (`xccov view --report --json`, has a `targets` key)
contains no line numbers, so it *cannot* fill the model — we detect it and
throw a message telling the user the exact command that produces the right
shape, rather than silently degrading.

## XML parsing

`fast-xml-parser` (zero transitive deps, widely used) rather than a hand-rolled
XML reader. Coverage XML is machine-generated but still XML — entities, CDATA,
self-closing forms, attribute quoting all appear in the wild, and regex-XML is
where parsers go to die. Tradeoff: one dependency in `@covallaby/parsers`;
acceptable against the maintenance cost of the alternative.

## Detection

`detectFormat` looks at content, not file names: LCOV record prefixes; XML with
a `<report` root + JaCoCo DTD/name vs `<coverage` with `line-rate`; JSON that
parses to the xccov archive shape. Ambiguity fails with the list of supported
formats — `--format` always wins.
