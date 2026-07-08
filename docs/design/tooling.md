# Design: Repository Tooling

Status: **Accepted** · Milestone 1

## Layout

pnpm workspace, exactly as the product spec prescribes:

```
packages/
  core/           @covallaby/core     — coverage model, summaries, thresholds
  parsers/        @covallaby/parsers  — LCOV (more formats in Milestone 5)
  cli/            covallaby           — the CLI
docs/
.github/
```

## Decisions

**Biome for linting *and* formatting** instead of ESLint + Prettier.
One tool, one config file, no plugin matrix, ~100× faster. Covallaby's whole
pitch is "dramatically simpler" — our own tooling should live that. Tradeoff:
smaller rule ecosystem than ESLint; acceptable because we lean on
`tsc --strict` for correctness and Biome for style/consistency.

**Plain `tsc` builds, ESM only, Node ≥ 20.** No bundler. These packages are
small libraries and a CLI; `tsc` emits readable JS with type declarations and
zero config debt. If the GitHub Action needs a single-file bundle later
(Milestone 3), we add `esbuild` to that one package only.

**Vitest** for tests (spec-preferred). Parser fixtures live in
`packages/parsers/fixtures/`; human-readable CLI output is snapshot-tested.

**commander** for CLI arg parsing. Tiny, zero-dep, battle-tested; hand-rolling
argument parsing is where CLIs go to accumulate bugs.

**Versioning:** fixed version across packages, released together. Simple to
reason about; revisit only if packages genuinely diverge.
