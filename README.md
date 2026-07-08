# 🦘 Covallaby

> Beautiful coverage reports for your pull requests.

Covallaby is a GitHub-first code coverage tool. No account, no upload token,
no dashboard you didn't ask for — just a friendly summary of what's covered,
what isn't, and whether you can merge.

```
  🦘 Covallaby

  Project coverage   91.4%
  Functions          88.0%
  Branches           76.2%
  842 of 921 lines covered across 47 files

  3 uncovered lines need some love:
    src/payment.ts:44-45
    src/checkout.ts:88
```

## Status

Early days — the CLI works today; the GitHub Action is next.

- ✅ **Milestone 1** — workspace, CI, linting, tests
- ✅ **Milestone 2** — coverage model, LCOV parser, CLI
- ✅ **Milestone 3** — GitHub Action: sticky PR comments, patch coverage, thresholds, Step Summary
- 🔜 **Milestone 4** — static HTML report
- 🔜 **Milestone 5** — JaCoCo, Cobertura, and xccov parsers

## CLI

```bash
# Summarize coverage (human output; add --json for machines)
covallaby report coverage/lcov.info

# Gate CI on a threshold — failures explain what to do next, never just "failed"
covallaby check coverage/lcov.info --min-project 85

# Sanity-check that a coverage file parses
covallaby validate coverage/lcov.info

# Generate an SVG badge
covallaby badge coverage/lcov.info -o coverage-badge.svg
```

Multiple files are merged automatically (useful for test shards):

```bash
covallaby report shard-1/lcov.info shard-2/lcov.info
```

## GitHub Action

```yaml
- uses: covallaby/covallaby/packages/github-action@main
  with:
    files: coverage/lcov.info
    min-patch: 85
```

One sticky PR comment. One Step Summary. One status check. Never spam.
The comment is updated in place on every push — your PR never fills up with
coverage noise. See [`examples/basic-workflow.yml`](examples/basic-workflow.yml)
for a complete workflow, and [`packages/github-action/action.yml`](packages/github-action/action.yml)
for every input. (`covallaby/action@v1` arrives once the action gets its own
mirror repo.)

**Patch coverage** — the number that answers "can I merge this?" — is computed
from the PR diff automatically, and only counts executable lines: comments and
blank lines never drag it down. Threshold failures tell you where to start,
never just "coverage failed."

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

Design decisions live in [`docs/design/`](docs/design/). Product and brand
guidance live in [`docs/PRODUCT.md`](docs/PRODUCT.md) and [`docs/BRAND.md`](docs/BRAND.md).

## Philosophy

- Beautiful by default. Zero config to start.
- The GitHub Action is the product; a hosted service will only ever be a bonus.
- Friendly language. Coverage tools should encourage, not shame.

## License

MIT
