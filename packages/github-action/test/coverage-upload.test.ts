import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadCoverageFiles } from "../src/coverage-upload.js";

describe("uploadCoverageFiles", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uploads umbrella shards into one hosted PR run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "covallaby-coverage-"));
    const first = join(dir, "core.info");
    const second = join(dir, "web.info");
    await writeFile(first, "TN:core\n");
    await writeFile(second, "TN:web\n");
    const fetch = vi
      .fn()
      .mockImplementation(async () =>
        Response.json({ ok: true, id: 12, url: "/r/acme/app/u/12" }, { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);

    await expect(
      uploadCoverageFiles({
        serverUrl: "https://app.covallaby.com",
        token: "secret",
        files: [first, second],
        repo: "acme/app",
        branch: "feature/coverage",
        commit: "abc123",
        pr: 42,
      }),
    ).resolves.toEqual({ uploaded: 2, url: "https://app.covallaby.com/r/acme/app/u/12" });

    const firstUrl = new URL(fetch.mock.calls[0]![0] as URL);
    const secondUrl = new URL(fetch.mock.calls[1]![0] as URL);
    expect(firstUrl.searchParams.get("merge")).toBeNull();
    expect(secondUrl.searchParams.get("merge")).toBe("1");
    expect(secondUrl.searchParams.get("pr")).toBe("42");
    expect(fetch.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      headers: { authorization: "Bearer secret" },
    });
  });

  it("reports the failing shard and server response", async () => {
    const dir = await mkdtemp(join(tmpdir(), "covallaby-coverage-"));
    const file = join(dir, "bad.info");
    await writeFile(file, "broken");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid LCOV", { status: 422 })),
    );

    await expect(
      uploadCoverageFiles({
        serverUrl: "https://app.covallaby.com",
        token: "secret",
        files: [file],
        repo: "acme/app",
        branch: "main",
        commit: "abc123",
        pr: null,
      }),
    ).rejects.toThrow(/bad\.info.*422.*invalid LCOV/);
  });
});
