import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { uploadPlaywrightRun } from "../src/playwright.js";

describe("Playwright playback upload", () => {
  it("uploads inline screenshot attachments as named journey steps", async () => {
    const dir = await mkdtemp(join(tmpdir(), "covallaby-playwright-inline-"));
    const results = join(dir, "results.json");
    await writeFile(
      results,
      JSON.stringify({
        suites: [
          {
            title: "onboarding.flow.spec.ts",
            specs: [
              {
                title: "new customer activates a dashboard",
                tests: [
                  {
                    results: [
                      {
                        status: "passed",
                        duration: 120,
                        attachments: [
                          {
                            name: "01-welcome",
                            contentType: "image/png",
                            body: Buffer.from("png bytes").toString("base64"),
                          },
                        ],
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
    let manifestArtifacts: Array<Record<string, unknown>> = [];
    let screenshotBody = "";

    await uploadPlaywrightRun({
      serverUrl: "https://app.example",
      token: "secret",
      resultsPath: results,
      artifactPaths: [],
      repo: "acme/app",
      branch: "main",
      commit: "abc",
      pr: null,
      fetch: (async (input, init = {}) => {
        const url = String(input);
        if (url.endsWith("/api/v1/test-runs")) {
          const body = JSON.parse(String(init.body)) as {
            artifacts: Array<Record<string, unknown>>;
          };
          manifestArtifacts = body.artifacts;
          return Response.json(
            {
              run: { id: 10 },
              artifacts: body.artifacts.map((_, index) => ({
                uploadUrl: `https://objects.example/${index}`,
              })),
              url: "/run/10",
            },
            { status: 201 },
          );
        }
        if (url === "https://objects.example/1")
          screenshotBody = Buffer.from(init.body as Uint8Array).toString();
        return new Response(null, { status: 200 });
      }) as typeof fetch,
    });

    expect(manifestArtifacts[1]).toMatchObject({
      name: "01-welcome.png",
      kind: "screenshot",
      contentType: "image/png",
      testName: "onboarding.flow.spec.ts › new customer activates a dashboard",
      sizeBytes: 9,
    });
    expect(manifestArtifacts[1]).not.toHaveProperty("body");
    expect(screenshotBody).toBe("png bytes");
  });

  it("keeps test names attached and uploads directly to signed storage", async () => {
    const dir = fileURLToPath(new URL("./fixtures/playwright", import.meta.url));
    const results = join(dir, "results.json");

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
        expect(body.testsSkipped).toBe(0);
        expect(body.testsFailed).toBe(0);
        expect(body.durationMs).toBeGreaterThan(0);
        expect(body.artifacts.find((a) => a.kind === "video")?.testName).toContain(
          "deterministic browser flow",
        );
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
      artifacts: 6,
    });
    const objectPuts = calls.filter((c) => c.url.startsWith("https://objects.example/"));
    expect(objectPuts).toHaveLength(6);
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

  it("does not discover attachments outside configured roots or leak tokens across origins", async () => {
    const root = await mkdtemp(join(tmpdir(), "covallaby-playwright-root-"));
    const outside = await mkdtemp(join(tmpdir(), "covallaby-playwright-outside-"));
    const secretFile = join(outside, "secret.txt");
    const allowedFile = join(root, "notes.txt");
    const results = join(root, "results.json");
    await writeFile(secretFile, "runner secret");
    await writeFile(allowedFile, "safe artifact");
    await writeFile(
      results,
      JSON.stringify({
        suites: [
          {
            specs: [
              {
                title: "untrusted attachment",
                tests: [
                  {
                    results: [{ status: "passed", attachments: [{ path: secretFile }] }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    const calls: Array<{ url: string; authorization?: string }> = [];
    await uploadPlaywrightRun({
      serverUrl: "https://app.example",
      token: "must-not-leak",
      resultsPath: results,
      artifactPaths: [root],
      repo: "acme/app",
      branch: "main",
      commit: "abc",
      pr: 1,
      fetch: (async (input, init = {}) => {
        const url = String(input);
        calls.push({
          url,
          authorization: (init.headers as Record<string, string> | undefined)?.authorization,
        });
        if (url.endsWith("/api/v1/test-runs")) {
          const body = JSON.parse(String(init.body)) as { artifacts: Array<{ name: string }> };
          expect(body.artifacts.map((artifact) => artifact.name)).toEqual([
            "results.json",
            "notes.txt",
          ]);
          return Response.json({
            run: { id: 4 },
            artifacts: [
              { uploadUrl: "https://app.example.evil.test/steal" },
              { uploadUrl: "/local-upload" },
            ],
            url: "/run/4",
          });
        }
        return new Response(null, { status: 200 });
      }) as typeof fetch,
    });
    const hostileUpload = calls.find((call) => call.url.includes("evil.test"));
    expect(hostileUpload?.authorization).toBeUndefined();
    const localUpload = calls.find((call) => call.url === "https://app.example/local-upload");
    expect(localUpload?.authorization).toBe("Bearer must-not-leak");
  });

  it("rejects a manifest with the wrong number of upload URLs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "covallaby-playwright-"));
    const results = join(dir, "results.json");
    await writeFile(results, JSON.stringify({ suites: [] }));
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
        fetch: async () =>
          Response.json({ run: { id: 1 }, artifacts: [], url: "/run/1" }, { status: 201 }),
      }),
    ).rejects.toThrow("0 upload URLs for 1 artifacts");
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
