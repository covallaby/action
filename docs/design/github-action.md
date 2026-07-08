# Design: The GitHub Action

Status: **Accepted** · Milestone 3

The Action is the product. One step in a workflow produces: a sticky PR
comment, a Step Summary, a status (pass/fail via exit code), and
machine-readable outputs.

```yaml
- uses: covallaby/action@v1
  with:
    files: coverage/lcov.info
    min-patch: 85
```

## Inputs (opinionated, minimal)

| Input | Default | Meaning |
|---|---|---|
| `files` | **required** | Coverage files, newline- or comma-separated. Merged if several. |
| `format` | auto-detect | Force a parser (`lcov`). |
| `strip-prefix` | `$GITHUB_WORKSPACE` | Prefix stripped so paths are repo-relative. |
| `min-project` | — | Minimum project line coverage %. |
| `min-patch` | — | Minimum coverage % of lines changed in the PR. |
| `min-new-file` | — | Minimum coverage % for each file added in the PR. |
| `comment` | `update` | `update` posts/updates the sticky comment; `off` disables. |
| `github-token` | `${{ github.token }}` | Token for the comment API. |

Outputs: `project-coverage`, `patch-coverage`, `uncovered-lines`, `ok`.

## Patch coverage semantics

Patch coverage = covered changed lines ÷ **coverable** changed lines.
A changed line counts only if the coverage report knows it's executable —
comments, blank lines, and type-only lines never drag the number down.
New-file coverage applies the same rule per added file.

Changed lines come from the PR's per-file unified diff hunks, fetched with
`pulls.listFiles` (paginated). We chose the API over `git diff` because
`actions/checkout` defaults to `fetch-depth: 1` — requiring users to deepen
the fetch would violate zero-config. The hunk parser itself is a pure
function in `@covallaby/core` (`parseUnifiedDiff`, `parseHunks`) so the CLI
can reuse it for `covallaby compare` later.

## Sticky comment

Every comment starts with `<!-- covallaby-report:v1 -->`.

1. List the PR's comments, find the first one whose body starts with the marker.
2. Update it if found; create it otherwise.
3. Never intentionally create duplicates.

Fork PRs get a read-only token, so comment upsert failures **warn and
continue** — the Step Summary and status still work, and the run only fails
on genuine threshold failures.

## Named statuses & diff annotations (Milestone 6)

Two additions that make coverage read natively in GitHub's UI, still with no
service behind them:

- **Commit statuses** — `covallaby/project` and `covallaby/patch` entries in
  the PR checks list via the Commit Status API, each with the percentage and
  target in its description, individually requirable in branch protection.
  Posted to the PR's *head* SHA (the merge-commit SHA wouldn't render in the
  checks list). Needs `statuses: write`; failures warn-and-continue like the
  comment does, so fork PRs stay green.
- **Annotations** — `core.warning(..., {file, startLine, endLine})` on
  uncovered *changed* lines, which GitHub renders directly in the PR diff.
  Zero API calls. Capped at 10 (GitHub's per-step display limit — and our
  never-spam rule); a closing notice says how many more there are.

Both default on, switchable off via `annotations`/`statuses` inputs.
Statuses use the head SHA from the PR payload, so they only apply in PR
context; push builds skip them (the job's own check already covers that case).

## Bundling

The Action is bundled with esbuild into a single committed
`dist/index.cjs` (Actions run from the repo without an install step).
CJS output avoids esbuild's ESM `dynamic require` pitfalls with the CJS
`@actions/*` toolkit. CI verifies the committed bundle is up to date so it
can't silently drift from the sources.

## Rejected alternatives

- **Docker action** — slower cold start, worse DX; Node is native on runners.
- **Comparing against a stored base report for project deltas** — needs
  storage (artifact juggling or a service). Patch coverage answers "can I
  merge this?" without any state; deltas can come later via the hosted bonus.
