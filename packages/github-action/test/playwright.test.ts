import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uploadPlaywrightRun } from "../src/playwright.js";

describe("Playwright playback upload", () => {
  it("keeps test names attached and uploads directly to signed storage", async () => {
    const dir = await mkdtemp(join(tmpdir(), "covallaby-playwright-"));
    const video = join(dir, "checkout.webm");
    const results = join(dir, "results.json");
    await writeFile(video, "video-bytes");
    await writeFile(
      results,
      JSON.stringify({
        suites: [
          {
            title: "checkout.spec.ts",
            specs: [
              {
                title: "buys a plan",
                tests: [
                  {
                    results: [
                      { status: "failed", duration: 100, attachments: [] },
                      {
                        status: "passed",
                        duration: 1234,
                        attachments: [{ name: "video", contentType: "video/webm", path: video }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/v1/test-runs")) {
        const body = JSON.parse(String(init.body)) as {
          testsPassed: number;
          durationMs: number;
          artifacts: Array<{ kind: string; testName: string | null }>;
        };
        expect(body.testsPassed).toBe(1);
        expect(body.durationMs).toBe(1334);
        expect(body.artifacts.find((a) => a.kind === "video")?.testName).toContain("buys a plan");
        return Response.json(
          {
            run: { id: 42 },
            artifacts: body.artifacts.map((_: unknown, i: number) => ({
              uploadUrl: `https://objects.example/${i}`,
            })),
            url: "/r/acme/app/test-runs/42",
          },
          { status: 201 },
        );
      }
      if (url.includes("/complete")) return Response.json({ ok: true });
      return new Response(null, { status: 200 });
    };

    const uploaded = await uploadPlaywrightRun({
      serverUrl: "https://app.example",
      token: "secret",
      resultsPath: results,
      artifactPaths: [],
      repo: "acme/app",
      branch: "feature",
      commit: "abc",
      pr: 7,
      fetch: fakeFetch as typeof fetch,
    });
    expect(uploaded).toEqual({
      id: 42,
      url: "https://app.example/r/acme/app/test-runs/42",
      artifacts: 2,
    });
    const objectPuts = calls.filter((c) => c.url.startsWith("https://objects.example/"));
    expect(objectPuts).toHaveLength(2);
    expect(objectPuts.every((c) => !(c.init.headers as Record<string, string>).authorization)).toBe(
      true,
    );
  });

  it("surfaces a rejected manifest before uploading files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "covallaby-playwright-"));
    const results = join(dir, "results.json");
    await writeFile(results, JSON.stringify({ suites: [] }));
    await expect(
      uploadPlaywrightRun({
        serverUrl: "https://app.example",
        token: "bad",
        resultsPath: results,
        artifactPaths: [],
        repo: "acme/app",
        branch: "main",
        commit: "abc",
        pr: null,
        fetch: async () => new Response("nope", { status: 401 }),
      }),
    ).rejects.toThrow("manifest failed (401)");
  });
});
