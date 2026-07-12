import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  captureStorybook,
  prepareComponentCaptures,
  readStoryIndex,
} from "../src/storybook-capture.js";

describe("Storybook story discovery", () => {
  it("packages pre-rendered PNG directories as fingerprinted component captures", async () => {
    const root = fileURLToPath(new URL("./fixtures/playwright", import.meta.url));
    const prepared = await prepareComponentCaptures(root);
    try {
      expect(prepared.captures).toEqual([
        expect.objectContaining({
          id: "screenshot",
          title: "Components",
          name: "screenshot",
          path: expect.stringMatching(/^_covallaby\/captures\/.*\.png$/),
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      ]);
      expect(await readFile(join(prepared.directory, "index.html"), "utf8")).toContain(
        "Review these captures in Covallaby",
      );
    } finally {
      await prepared.cleanup();
    }
  });

  it("uses index.json as the authoritative capture list and excludes docs entries", async () => {
    const root = fileURLToPath(new URL("./fixtures/storybook", import.meta.url));
    const stories = await readStoryIndex(root);

    expect(stories.length).toBeGreaterThan(1);
    expect(stories[0]).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      name: expect.any(String),
      path: expect.stringMatching(/^_covallaby\/captures\/.*\.png$/),
    });
    expect(stories.some((story) => story.id.endsWith("--docs"))).toBe(false);
  });

  it.runIf(
    [
      process.env.COVALLABY_CHROME_PATH,
      "/usr/bin/google-chrome",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ].some((path) => path && existsSync(path)),
  )(
    "renders real component PNGs without the Storybook manager UI",
    async () => {
      const root = fileURLToPath(new URL("./fixtures/storybook", import.meta.url));
      const result = await captureStorybook(root, "required");
      try {
        expect(result.captures.length).toBeGreaterThan(1);
        const png = await readFile(join(root, result.captures[0]!.path));
        expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        expect(result.captures[0]!.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(await readFile(join(root, "_covallaby/stories.json"), "utf8")).toContain(
          result.captures[0]!.id,
        );
      } finally {
        await rm(join(root, "_covallaby"), { recursive: true, force: true });
      }
    },
    30_000,
  );
});
