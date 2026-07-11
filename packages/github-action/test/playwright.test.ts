import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { uploadPlaywrightRun } from "../src/playwright.js";

describe("Playwright playback upload", () => {
  it("keeps test names attached and uploads directly to signed storage", async () => {
    const dir = await mkdtemp(join(tmpdir(), "covallaby-playwright-"));
    const video = join(dir, "checkout.webm");
    const notes = join(dir, "notes.txt");
    const results = join(dir, "results.json");
    await writeFile(video, "video-bytes");
    await writeFile(notes, "debug notes");
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
              {
                title: "skips a browser",
                tests: [{ results: [{ status: "skipped", duration: 0 }] }],
              },
              { title: "fails before launch", tests: [{ results: [] }] },
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
          testsFailed: number;
          testsSkipped: number;
          durationMs: number;
          artifacts: Array<{ kind: string; testName: string | null }>;
        };
        expect(body.testsPassed).toBe(1);
        expect(body.testsSkipped).toBe(1);
        expect(body.testsFailed).toBe(1);
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
      artifactPaths: [dir],
      repo: "acme/app",
      branch: "feature",
      commit: "abc",
      pr: 7,
      fetch: fakeFetch as typeof fetch,
    });
    expect(uploaded).toEqual({
      id: 42,
      url: "https://app.example/r/acme/app/test-runs/42",
      artifacts: 3,
    });
    const objectPuts = calls.filter((c) => c.url.startsWith("https://objects.example/"));
    expect(objectPuts).toHaveLength(3);
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

  it("surfaces object upload and completion failures", async () => {
    const dir = await mkdtemp(join(tmpdir(), "covallaby-playwright-"));
    const results = join(dir, "results.json");
    await writeFile(results, JSON.stringify({ suites: [] }));
    const manifest = {
      run: { id: 9 },
      artifacts: [{ uploadUrl: "https://objects.example/0" }],
      url: "/run/9",
    };
    await expect(
      uploadPlaywrightRun({
        serverUrl: "https://app.example",
        token: "secret",
        resultsPath: results,
        artifactPaths: [],
        repo: "acme/app",
        branch: "main",
        commit: "abc",
        pr: null,
        fetch: async (input) =>
          String(input).endsWith("/api/v1/test-runs")
            ? Response.json(manifest, { status: 201 })
            : new Response("storage down", { status: 500 }),
      }),
    ).rejects.toThrow("Uploading results.json failed (500)");

    await expect(
      uploadPlaywrightRun({
        serverUrl: "https://app.example",
        token: "secret",
        resultsPath: results,
        artifactPaths: [],
        repo: "acme/app",
        branch: "main",
        commit: "abc",
        pr: null,
        fetch: async (input) => {
          const url = String(input);
          if (url.endsWith("/api/v1/test-runs")) return Response.json(manifest, { status: 201 });
          if (url.includes("/complete")) return new Response("missing", { status: 409 });
          return new Response(null, { status: 200 });
        },
      }),
    ).rejects.toThrow("Completing Covallaby playback failed (409)");
  });
});
