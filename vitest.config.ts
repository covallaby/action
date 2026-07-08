import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const pkg = (path: string) => fileURLToPath(new URL(`packages/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against sources, so no build step is needed before `pnpm test`.
    alias: {
      "@covallaby/core": pkg("core/src/index.ts"),
      "@covallaby/parsers": pkg("parsers/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "packages/*/test/**/*.test.ts"],
    // picocolors turns ANSI on when CI is set; pin it off so human-output
    // snapshots are identical locally and on CI.
    env: { NO_COLOR: "1" },
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text-summary"],
      include: ["packages/*/src/**"],
      exclude: ["**/*.test.ts", "packages/github-action/src/entry.ts", "packages/cli/src/bin.ts"],
    },
  },
});
