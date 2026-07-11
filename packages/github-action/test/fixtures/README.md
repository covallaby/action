# Golden browser fixtures

These files are intentionally committed so uploader and artifact regressions are
deterministic, offline, and independent of browser availability.

- `playwright/` is a genuine Playwright run: JSON reporter output, WebM video,
  PNG screenshot, trace ZIP, and self-contained HTML report.
- `storybook/` is Covallaby's real Storybook 10 production build, including the
  manager, preview iframe, addons, fonts, CSS, and nested JavaScript chunks.

Regenerate Playwright fixtures after an intentional Playwright upgrade:

```sh
pnpm fixtures:generate
```

Regenerate Storybook in the Covallaby server repository with
`pnpm build:storybook`, then replace this directory. Review fixture size and
manifest changes before committing. Golden assets should stay below 10 MB total.
