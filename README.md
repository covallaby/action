# 🦘 Covallaby

[![CI](https://github.com/covallaby/covallaby/actions/workflows/ci.yml/badge.svg)](https://github.com/covallaby/covallaby/actions/workflows/ci.yml)

**Beautiful coverage reports for your pull requests.** No account, no upload
token, no dashboard you didn't ask for — one workflow step, and every PR
answers the only question that matters: *can I merge this?*

> ## 🦘 Covallaby
>
> You're covered.
>
> | Metric | Result |
> |---|---|
> | Project coverage | 91.4% |
> | Patch coverage | 96.8% |
> | Required | patch 85.0% |
>
> Nice jump! Every changed line that can be tested, is. 🎉

## Quick start

```yaml
name: Tests

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write # sticky comment
  statuses: write # covallaby/project + covallaby/patch checks
  checks: write # the "Covallaby" Checks-tab entry

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test -- --coverage # anything that writes a coverage file
      - uses: covallaby/covallaby/packages/github-action@main
        with:
          files: coverage/lcov.info
          min-patch: 85
```

That's the whole setup. Every PR then gets:

- **One sticky comment** — updated in place on every push, never spamming the
  thread, with collapsed per-file and per-directory breakdowns.
- **Named checks** — `covallaby/patch — 96.8% (target 85.0%)` and
  `covallaby/project` in the checks list, individually requirable in branch
  protection.
- **A "Covallaby" entry in the Checks tab** — the full report as its own page.
- **Diff annotations** — warning boxes directly on untested changed lines in
  the Files-changed view.
- **A CI gate** — failures explain what to do next
  (*"Patch coverage is 72.0%, but 85.0% is required. 4 changed lines aren't
  covered yet — start with `src/payment.ts:44-45`"*), never just
  "coverage failed."

See it live: [a passing PR](https://github.com/covallaby/covallaby/pull/1) ·
[a failing PR](https://github.com/covallaby/covallaby/pull/2) ·
[a docs-only PR](https://github.com/covallaby/covallaby/pull/3).

## 🤖 Install with AI

Tell your coding agent (Claude Code, Cursor, Copilot…):

> Read https://raw.githubusercontent.com/covallaby/covallaby/main/llms-install.md
> and set up Covallaby in this repository.

Or from a terminal with Claude Code:

```bash
curl -fsSL https://raw.githubusercontent.com/covallaby/covallaby/main/llms-install.md | claude
```

[`llms-install.md`](llms-install.md) walks the agent through producing a
coverage file for your stack, wiring the workflow, and verifying the result.

## Producing a coverage file

Covallaby reads what your test runner writes — LCOV, JaCoCo XML, Cobertura
XML, and xccov JSON, auto-detected from content.

<details>
<summary><strong>Vitest / Jest</strong> (LCOV)</summary>

```bash
# Vitest (needs @vitest/coverage-v8)
vitest run --coverage --coverage.reporter=lcov
# Jest
jest --coverage
```

→ `files: coverage/lcov.info`
</details>

<details>
<summary><strong>Python — pytest</strong> (Cobertura)</summary>

```bash
pytest --cov --cov-report=xml   # needs pytest-cov
```

→ `files: coverage.xml`
</details>

<details>
<summary><strong>Java / Kotlin — JaCoCo</strong> (XML)</summary>

Gradle — apply the `jacoco` plugin and enable the XML report:

```groovy
jacocoTestReport { reports { xml.required = true } }
```

```bash
./gradlew test jacocoTestReport
```

→ `files: build/reports/jacoco/test/jacocoTestReport.xml`

Maven — configure `jacoco-maven-plugin` (`prepare-agent` + `report`), then
`mvn verify` → `files: target/site/jacoco/jacoco.xml`
</details>

<details>
<summary><strong>.NET — coverlet</strong> (Cobertura)</summary>

```bash
dotnet test --collect:"XPlat Code Coverage"
```

→ `files: TestResults/**/coverage.cobertura.xml` (glob the GUID directory)
</details>

<details>
<summary><strong>Swift — Xcode xccov</strong> (JSON)</summary>

```bash
xcodebuild test -scheme MyApp -enableCodeCoverage YES -resultBundlePath Result.xcresult
xcrun xccov view --archive --json Result.xcresult > coverage.json
```

→ `files: coverage.json`
</details>

<details>
<summary><strong>Go</strong> (via gcov2lcov)</summary>

Go's coverprofile isn't ingested natively yet
([convert with gcov2lcov](https://github.com/jandelgado/gcov2lcov)):

```bash
go test -coverprofile=coverage.out ./...
gcov2lcov -infile=coverage.out -outfile=coverage.lcov
```

→ `files: coverage.lcov`
</details>

Multiple files merge automatically (test shards, mixed suites):
`files: shard-1/lcov.info, shard-2/lcov.info`.

## Inputs

| Input | Description | Default |
|---|---|---|
| `files` | Coverage files, comma/newline separated. **Required.** | — |
| `min-patch` | Min coverage % of the lines changed in the PR. | off |
| `min-project` | Min project line coverage %. | off |
| `min-new-file` | Min coverage % for each file added in the PR. | off |
| `comment` | `update` (one sticky comment) or `off`. | `update` |
| `breakdown` | Directory rollup: `auto`, a fixed depth, or `off`. | `auto` |

<details>
<summary>All inputs</summary>

| Input | Description | Default |
|---|---|---|
| `format` | Force a parser: `lcov`, `jacoco`, `cobertura`, `xccov`. | auto-detect |
| `strip-prefix` | Path prefix stripped so paths are repo-relative. | workspace |
| `check` | The rich "Covallaby" Checks-tab entry. | `true` |
| `annotations` | Warnings on uncovered changed lines in the diff. | `true` |
| `statuses` | `covallaby/project` + `covallaby/patch` commit statuses. | `true` |
| `github-token` | Token for comments/checks/statuses. | `github.token` |

</details>

Outputs: `project-coverage`, `patch-coverage`, `uncovered-lines`, `ok`.

## CLI

Everything works locally too:

```bash
covallaby report coverage/lcov.info          # friendly summary (--json for machines)
covallaby check coverage/lcov.info --min-project 85
covallaby html coverage/lcov.info -o report  # one-file HTML report: dark mode, search
covallaby badge coverage/lcov.info -o coverage-badge.svg
covallaby validate coverage/lcov.info        # does this file parse?
```

The HTML report is a single self-contained `index.html` — our CI attaches it
to every run as the `covallaby-report` artifact.

## Troubleshooting

- **`Couldn't read "coverage/lcov.info"`** — your test step didn't write
  coverage there. Run the tests with coverage enabled *before* the Covallaby
  step, and point `files` at the real output path.
- **Warnings about comments/statuses on fork PRs** — expected: fork tokens are
  read-only. The Step Summary and gate still work; nothing fails because of it.
- **File paths in the report don't match your repo** — some tools emit
  absolute paths; set `strip-prefix` to the directory your build ran in.

## How failure works

The Action both *explains* and *blocks*: named statuses carry the numbers,
and the step fails its job when a gate misses (that's what disables the merge
button — zero configuration required). If you use branch protection, you can
instead require `covallaby/patch` directly.

## Status

All MVP milestones are complete: coverage model · LCOV/JaCoCo/Cobertura/xccov
parsers · CLI · GitHub Action (sticky comments, patch coverage, thresholds,
named checks, annotations) · static HTML report. Design decisions live in
[`docs/design/`](docs/design/). npm packages and a `covallaby/action@v1`
mirror are next.

## Development

Node ≥ 20 and pnpm (`corepack enable pnpm`), then:

```bash
pnpm install
pnpm verify   # lint + build + typecheck + test
```

| Package | What it is |
|---|---|
| `@covallaby/core` | Shared coverage model, summaries, thresholds, badge |
| `@covallaby/parsers` | LCOV, JaCoCo, Cobertura, xccov → one model |
| `covallaby` | The CLI |
| `@covallaby/html-report` | Single-file HTML report (React + Tailwind) |
| `@covallaby/github-action` | The Action |

## Philosophy

- **Beautiful by default.** Zero config to start; opinionated defaults everywhere.
- **The GitHub Action is the product.** A hosted service will only ever be a bonus.
- **Friendly, never shaming.** Point at the next step, don't wag a finger.

## License

MIT
