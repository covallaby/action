# Install Covallaby in this repository

This file is written for AI coding agents (Claude Code, Cursor, Copilot
Workspace, …). If you are an agent: **execute the steps below autonomously**,
adapting to this repository's stack. If you are a human: paste this file's URL
into your assistant and ask it to follow it.

## OBJECTIVE

Add the Covallaby GitHub Action so every pull request gets a coverage report:
one sticky comment, named checks (`covallaby/project`, `covallaby/patch`), a
"Covallaby" entry in the Checks tab, diff annotations on untested lines, and a
CI gate on patch coverage.

## TODO

### 1. Make the test suite produce a coverage file

Detect the repo's test stack and apply exactly one branch:

- **Vitest** — ensure `@vitest/coverage-v8` is a devDependency; run tests with
  `vitest run --coverage --coverage.reporter=lcov` (or add
  `test: { coverage: { reporter: ["text", "lcov"] } }` to `vitest.config.ts`).
  Coverage file: `coverage/lcov.info`.
- **Jest** — run with `jest --coverage`. Coverage file: `coverage/lcov.info`.
- **pytest** — ensure `pytest-cov` is installed; run
  `pytest --cov --cov-report=xml`. Coverage file: `coverage.xml`.
- **JaCoCo (Gradle)** — apply the `jacoco` plugin and enable
  `jacocoTestReport { reports { xml.required = true } }`; run
  `./gradlew test jacocoTestReport`. Coverage file:
  `build/reports/jacoco/test/jacocoTestReport.xml`.
- **JaCoCo (Maven)** — configure `jacoco-maven-plugin` with `prepare-agent`
  and `report` goals; run `mvn verify`. Coverage file:
  `target/site/jacoco/jacoco.xml`.
- **.NET** — run `dotnet test --collect:"XPlat Code Coverage"`. Coverage file:
  `TestResults/**/coverage.cobertura.xml`.
- **Xcode** — build with `-enableCodeCoverage YES -resultBundlePath
  Result.xcresult`, then export per-line JSON:
  `xcrun xccov view --archive --json Result.xcresult > coverage.json`.
- **Go** — convert the coverprofile:
  `go test -coverprofile=coverage.out ./...` then
  `gcov2lcov -infile=coverage.out -outfile=coverage.lcov`
  (or use `jandelgado/gcov2lcov-action` in CI).

Formats are auto-detected from content; never rename files to hint the format.

### 2. Add or extend the workflow

If a workflow already runs tests on `pull_request`, add the permissions and
the Covallaby step to it. Otherwise create `.github/workflows/tests.yml`:

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
      # …existing setup + test-with-coverage steps from TODO 1…
      - name: Coverage report
        uses: covallaby/covallaby/packages/github-action@main
        with:
          files: <coverage file path from TODO 1>
          min-patch: 85
```

Rules:
- `files` must point at the coverage file the test step actually writes.
- Keep `min-patch` at 85 unless the repo owner asked for a different gate;
  only add `min-project` if asked — it punishes pre-existing gaps.
- Never add a second Covallaby step or a second coverage tool to the same job.

### 3. Verify locally if possible

Run the test command from TODO 1 and confirm the coverage file exists and is
non-empty before pushing.

## DONE WHEN

- A pull request run shows: a "🦘 Covallaby" sticky comment, `covallaby/project`
  and `covallaby/patch` in the checks list, and a "Covallaby" entry in the
  Checks tab.
- An intentionally untested change fails `covallaby/patch` and annotates the
  uncovered lines in the diff.
- Re-pushing updates the existing comment instead of adding a new one.

## Troubleshooting

- **"Couldn't read \<file\>"** — the test step didn't write coverage where
  `files` points; fix the path or the test command.
- **Comment/status warnings on fork PRs** — expected; fork tokens are
  read-only. The Step Summary still carries the report.
- **Paths don't match the repo** — coverage tools sometimes emit absolute
  paths; set `strip-prefix` to the build root (defaults to the workspace).
