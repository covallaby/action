# Design: The Static HTML Report

Status: **Accepted** · Milestone 4

`covallaby html` produces a single self-contained `index.html` — no server, no
CDN, no network at all. It works downloaded from a GitHub Actions artifact and
double-clicked from a zip.

## Shape

- **One file.** Vite + `vite-plugin-singlefile` inlines all JS/CSS into
  `dist/index.html`, which ships inside the `@covallaby/html-report` package as
  a *template*. The CLI injects data by replacing a `__COVALLABY_DATA__`
  placeholder inside a `<script type="application/json">` tag (JSON is
  `<`-escaped so `</script>` can't break out). In dev, the placeholder fails
  `JSON.parse` and the app falls back to demo data — so `vite dev` just works.
- **React + Tailwind** (the spec's preferred stack), hash-routed:
  `#/` overview + searchable file table · `#/file/<path>` source detail ·
  `#/missing` uncovered ranges · `#/diff` patch view (only when the CLI was
  given `--diff`).
- **Summaries are computed in the browser with `@covallaby/core`** — the same
  `summarize`/`computePatchCoverage` the CLI and Action use. The payload is the
  raw model (report + sources + optional patch), so numbers can never disagree
  across surfaces.

## Payload

```ts
{
  generatedAt: string,
  version: string,
  report: CoverageReport,             // the shared model
  sources: Record<string, string>,    // path -> file text (best effort)
  patch?: ChangedFile[]               // when --diff was provided
}
```

Sources are read from `--source-root` (default cwd), skipped silently when
missing, capped at 512 KB per file — the report degrades to range lists
instead of failing.

## Visual system

Follows the dataviz method: form first, status color mapped by job, text never
wears the data color.

- Stat tiles for project/patch/functions/branches; the file list is a table
  with per-file **meters** — fill carries severity, the unfilled track is a
  lighter step of the same ramp, and the percentage is always adjacent as text.
- Severity: ≥90 good · ≥75 warning · ≥50 serious · <50 critical (status
  palette, reserved — never used for anything but coverage state).
- Light + dark from one set of role tokens; dark mode follows
  `prefers-color-scheme` with a manual toggle persisted to `localStorage`.
- `tabular-nums` in table columns only; no pie charts, no gauges.

## Rejected alternatives

- **GitHub Pages as the default hosting story.** A repo has exactly one Pages
  site, and it usually belongs to the project's docs. Recommending (or CI-ing)
  a coverage deploy onto that slot is a land grab for a side feature. The free
  tier's surfaces are the PR comment, the Step Summary, and the report
  artifact; always-live hosted reports are what the optional hosted service is
  for. Same reasoning killed committing badges/reports back to the repo:
  generated files on main break under branch protection and race concurrent
  pushes.

- **Multi-page static site** (like istanbul's html reporter): breaks as an
  artifact — relative navigation from a zip works, but search and dark mode
  would need duplication per page, and one file is trivially portable.
- **Server-rendered templates from the CLI**: no interactivity budget for
  search/filtering without shipping JS anyway; React keeps the UI maintainable.
- **Embedding rendered HTML per source line at generate time**: bloats output
  ~10× vs shipping raw source text and rendering client-side.
