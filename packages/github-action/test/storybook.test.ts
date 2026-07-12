import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { uploadStorybookPreview } from "../src/storybook.js";

describe("Storybook preview upload", () => {
  it("preserves relative paths and protects the server token", async () => {
    const root = fileURLToPath(new URL("./fixtures/storybook", import.meta.url));
    const calls: Array<{ url: string; authorization?: string }> = [];
    const result = await uploadStorybookPreview({
      serverUrl: "https://app.example",
      token: "secret",
      directory: root,
      repo: "acme/app",
      branch: "feature/button",
      commit: "abc",
      pr: 9,
      captureMode: "off",
      fetch: (async (input, init = {}) => {
        const url = String(input);
        calls.push({
          url,
          authorization: (init.headers as Record<string, string> | undefined)?.authorization,
        });
        if (url.endsWith("/api/v1/storybook-previews")) {
          const body = JSON.parse(String(init.body)) as { files: Array<{ path: string }> };
          expect(body.files.some((file) => file.path === "index.html")).toBe(true);
          expect(body.files.some((file) => file.path === "iframe.html")).toBe(true);
          expect(body.files.some((file) => file.path.startsWith("sb-manager/"))).toBe(true);
          return Response.json(
            {
              run: { id: 8 },
              // The API contract identifies artifacts by path, not array position.
              artifacts: body.files
                .map((file) => ({
                  path: file.path,
                  uploadUrl:
                    file.path === "index.html"
                      ? "/local/index.html"
                      : `https://objects.example/${file.path}`,
                }))
                .reverse(),
              url: "/r/acme/app/storybook-previews/8",
            },
            { status: 201 },
          );
        }
        return new Response(null, { status: 200 });
      }) as typeof fetch,
    });
    expect(result).toEqual({
      id: 8,
      url: "https://app.example/r/acme/app/storybook-previews/8",
      files: 30,
      captures: 0,
      captureSkipped: "disabled",
    });
    expect(
      calls.find((call) => call.url.includes("objects.example"))?.authorization,
    ).toBeUndefined();
    expect(calls.find((call) => call.url.includes("/local/index.html"))?.authorization).toBe(
      "Bearer secret",
    );
  });

  it("requires a built Storybook index", async () => {
    const root = await mkdtemp(join(tmpdir(), "covallaby-storybook-"));
    await writeFile(join(root, "not-storybook.txt"), "nope");
    await expect(
      uploadStorybookPreview({
        serverUrl: "https://app.example",
        token: "secret",
        directory: root,
        repo: "acme/app",
        branch: "main",
        commit: "abc",
        pr: null,
        captureMode: "off",
        fetch: async () => new Response(null),
      }),
    ).rejects.toThrow("does not contain index.html");
  });

  it("reports manifest, upload-map, object, and completion failures clearly", async () => {
    const root = await mkdtemp(join(tmpdir(), "covallaby-storybook-"));
    await writeFile(join(root, "index.html"), "<h1>Storybook</h1>");
    const options = {
      serverUrl: "https://app.example",
      token: "secret",
      directory: root,
      repo: "acme/app",
      branch: "main",
      commit: "abc",
      pr: null,
      captureMode: "off" as const,
    };
    await expect(
      uploadStorybookPreview({
        ...options,
        fetch: async () => new Response("denied", { status: 401 }),
      }),
    ).rejects.toThrow("Storybook manifest failed (401)");

    await expect(
      uploadStorybookPreview({
        ...options,
        fetch: async () => Response.json({ run: { id: 1 }, artifacts: [], url: "/preview/1" }),
      }),
    ).rejects.toThrow("0 upload URLs for 1 Storybook files");

    const manifest = (path = "index.html") => ({
      run: { id: 1 },
      artifacts: [{ path, uploadUrl: "https://objects.example/index.html" }],
      url: "/preview/1",
    });
    await expect(
      uploadStorybookPreview({
        ...options,
        fetch: async () => Response.json(manifest("wrong.html")),
      }),
    ).rejects.toThrow("did not return an upload URL for Storybook file index.html");

    await expect(
      uploadStorybookPreview({
        ...options,
        fetch: async (input) =>
          String(input).endsWith("/api/v1/storybook-previews")
            ? Response.json(manifest())
            : new Response("storage down", { status: 500 }),
      }),
    ).rejects.toThrow("Uploading Storybook file index.html failed (500)");

    await expect(
      uploadStorybookPreview({
        ...options,
        fetch: async (input) => {
          const url = String(input);
          if (url.endsWith("/api/v1/storybook-previews")) return Response.json(manifest());
          if (url.endsWith("/complete")) return new Response("missing", { status: 409 });
          return new Response(null, { status: 200 });
        },
      }),
    ).rejects.toThrow("Completing Covallaby Storybook preview failed (409)");
  });
});
