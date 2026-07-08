<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./brand/svg/logo-horizontal-dark.svg">
    <img src="./brand/svg/logo-horizontal.svg" alt="Covallaby" width="420">
  </picture>
</p>

<p align="center">
  <strong>Beautiful coverage reports for your pull requests.</strong>
</p>

<p align="center">
  No account. No upload token. No dashboard you didn't ask for.<br>
  Just a friendly answer to the only question that matters: <em>can I merge this?</em>
</p>

---

```yaml
- uses: covallaby/covallaby/packages/github-action@main
  with:
    files: coverage/lcov.info
    min-patch: 85
```

That's the whole setup. Every pull request gets one sticky comment — updated
in place on each push, never spamming your PR — plus a Step Summary and a
pass/fail status check:

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

**Patch coverage** is computed from the PR diff automatically and only counts
executable lines — comments and blank lines never drag it down. When a
threshold fails, Covallaby tells you where to start
(`Patch coverage is 72.0%, but 85.0% is required. 4 changed lines aren't
covered yet — start with src/payment.ts:44-45`), never just "coverage failed."

See [`examples/basic-workflow.yml`](examples/basic-workflow.yml) for a complete
workflow and [`packages/github-action/action.yml`](packages/github-action/action.yml)
for every input. (`covallaby/action@v1` arrives once the Action gets its own
mirror repo.)

## CLI

Everything the Action does works locally too:

```bash
# Summarize coverage (add --json for machines)
covallaby report coverage/lcov.info

# Gate CI on a threshold
covallaby check coverage/lcov.info --min-project 85

# Sanity-check that a coverage file parses
covallaby validate coverage/lcov.info

# Generate an SVG badge
covallaby badge coverage/lcov.info -o coverage-badge.svg
```

Multiple files are merged automatically — handy for test shards:

```bash
covallaby report shard-1/lcov.info shard-2/lcov.info
```

## Status

Early days, moving in milestones. Each one leaves the repo releasable.

- ✅ **Milestone 1** — workspace, CI, linting, tests
- ✅ **Milestone 2** — coverage model, LCOV parser, CLI
- ✅ **Milestone 3** — GitHub Action: sticky PR comments, patch coverage, thresholds, Step Summary
- 🔜 **Milestone 4** — static HTML report (dark mode, searchable, no server)
- 🔜 **Milestone 5** — JaCoCo, Cobertura, and xccov parsers

## Development

Requires Node ≥ 20 and pnpm (`corepack enable pnpm`).

```bash
pnpm install
pnpm verify   # lint + build + typecheck + test
```

The repo is a pnpm workspace:

| Package | What it is |
|---|---|
| `@covallaby/core` | The shared coverage model, summaries, thresholds, badge |
| `@covallaby/parsers` | Format parsers that normalize into the model |
| `covallaby` | The CLI |
| `@covallaby/github-action` | The Action |

Design decisions live in [`docs/design/`](docs/design/). Brand assets and the
brand guide live in [`brand/`](brand/).

## Philosophy

- **Beautiful by default.** Zero config to start; opinionated defaults everywhere.
- **The GitHub Action is the product.** A hosted service will only ever be a bonus, never a requirement.
- **Friendly, never shaming.** Coverage tools should point at the next step, not wag a finger.

## License

MIT
