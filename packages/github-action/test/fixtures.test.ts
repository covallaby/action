import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const fixtures = fileURLToPath(new URL("./fixtures", import.meta.url));

describe("committed golden fixtures", () => {
  it("contains genuine Playwright binary formats with intact checksums", async () => {
    const root = join(fixtures, "playwright");
    const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8")) as {
      generatedBy: string;
      checksums: Record<string, string>;
    };
    expect(manifest.generatedBy).toMatch(/^@playwright\/test@/);
    for (const [path, expected] of Object.entries(manifest.checksums)) {
      const actual = createHash("sha256")
        .update(await readFile(join(root, path)))
        .digest("hex");
      expect(actual, path).toBe(expected);
    }
    expect((await readFile(join(root, "video.webm"))).subarray(0, 4)).toEqual(
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
    );
    expect((await readFile(join(root, "screenshot.png"))).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect((await readFile(join(root, "trace.zip"))).subarray(0, 2).toString()).toBe("PK");
    expect(await readFile(join(root, "html-report", "index.html"), "utf8")).toContain("Playwright");
  });

  it("contains a navigable real Storybook build with all entrypoint assets", async () => {
    const root = join(fixtures, "storybook");
    const index = await readFile(join(root, "index.html"), "utf8");
    const iframe = await readFile(join(root, "iframe.html"), "utf8");
    const storyIndex = JSON.parse(await readFile(join(root, "index.json"), "utf8")) as {
      entries: Record<string, { title: string }>;
    };
    expect(
      Object.values(storyIndex.entries).some((entry) => entry.title.includes("Dashboard")),
    ).toBe(true);
    const references = [
      ...index.matchAll(/(?:src|href)="\.\/([^"?#]+)[^"\s]*"/g),
      ...iframe.matchAll(/(?:src|href)="\.\/([^"?#]+)[^"\s]*"/g),
    ]
      .map((match) => match[1]!)
      .filter((path) => !path.startsWith("http"));
    expect(references.length).toBeGreaterThan(3);
    for (const path of references) await expect(access(join(root, path))).resolves.toBeUndefined();
  });
});
