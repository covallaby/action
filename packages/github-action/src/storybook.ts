import { createReadStream } from "node:fs";
import { readdir, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { captureStorybook } from "./storybook-capture.js";
import type { StoryCapture } from "./storybook-capture.js";

export interface StorybookUploadOptions {
  serverUrl: string;
  token: string;
  directory: string;
  repo: string;
  branch: string;
  commit: string;
  pr: number | null;
  fetch?: typeof globalThis.fetch;
  captureMode?: "auto" | "required" | "off";
  captures?: StoryCapture[];
}

const MIME: Record<string, string> = {
  ".css": "text/css",
  ".gif": "image/gif",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".map": "application/json",
  ".mjs": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const isWithin = (path: string, root: string): boolean => {
  const fromRoot = relative(root, path);
  return (
    fromRoot === "" ||
    (fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot))
  );
};

async function filesUnder(path: string, root: string): Promise<string[]> {
  const actual = await realpath(path);
  if (!isWithin(actual, root)) return [];
  const info = await stat(actual);
  if (info.isFile()) return [actual];
  const entries = await readdir(actual, { withFileTypes: true });
  return (
    await Promise.all(entries.map((entry) => filesUnder(resolve(actual, entry.name), root)))
  ).flat();
}

export async function uploadStorybookPreview(options: StorybookUploadOptions): Promise<{
  id: number;
  url: string;
  files: number;
  captures: number;
  reviewState: string;
  captureSkipped?: string;
}> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const root = await realpath(resolve(options.directory));
  const capture = options.captures
    ? { captures: options.captures }
    : await captureStorybook(root, options.captureMode ?? "auto");
  const capturesByPath = new Map(capture.captures.map((story) => [story.path, story]));
  const paths = await filesUnder(root, root);
  const files = await Promise.all(
    paths.map(async (path) => ({
      path,
      relativePath: relative(root, path).split(sep).join("/"),
      contentType: MIME[extname(path).toLowerCase()] ?? "application/octet-stream",
      sizeBytes: (await stat(path)).size,
      ...(capturesByPath.has(relative(root, path).split(sep).join("/")) && {
        kind: "screenshot",
        testName: JSON.stringify(capturesByPath.get(relative(root, path).split(sep).join("/"))),
      }),
    })),
  );
  if (!files.some((file) => file.relativePath === "index.html")) {
    throw new Error(`Storybook directory ${options.directory} does not contain index.html.`);
  }
  const auth = { authorization: `Bearer ${options.token}` };
  const created = await fetcher(`${options.serverUrl}/api/v1/storybook-previews`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      repo: options.repo,
      branch: options.branch,
      commit: options.commit,
      pr: options.pr,
      files: files.map(({ path: _, relativePath, ...file }) => ({
        path: relativePath,
        ...file,
      })),
    }),
  });
  if (!created.ok) {
    throw new Error(
      `Covallaby Storybook manifest failed (${created.status}): ${await created.text()}`,
    );
  }
  const manifest = (await created.json()) as {
    run: { id: number; reviewState?: string };
    artifacts: Array<{ path: string; uploadUrl: string }>;
    url: string;
  };
  if (manifest.artifacts.length !== files.length) {
    throw new Error(
      `Covallaby returned ${manifest.artifacts.length} upload URLs for ${files.length} Storybook files.`,
    );
  }
  const artifactsByPath = new Map(manifest.artifacts.map((artifact) => [artifact.path, artifact]));
  if (artifactsByPath.size !== manifest.artifacts.length) {
    throw new Error("Covallaby returned duplicate Storybook upload paths.");
  }
  const serverOrigin = new URL(options.serverUrl).origin;
  for (let start = 0; start < files.length; start += 8) {
    await Promise.all(
      files.slice(start, start + 8).map(async (file) => {
        const target = artifactsByPath.get(file.relativePath);
        if (!target) {
          throw new Error(
            `Covallaby did not return an upload URL for Storybook file ${file.relativePath}.`,
          );
        }
        const targetUrl = new URL(target.uploadUrl, `${options.serverUrl}/`);
        const uploaded = await fetcher(targetUrl.toString(), {
          method: "PUT",
          headers: {
            "content-type": file.contentType,
            "content-length": String(file.sizeBytes),
            ...(targetUrl.origin === serverOrigin ? auth : {}),
          },
          body: createReadStream(file.path) as never,
          duplex: "half",
        } as RequestInit);
        if (!uploaded.ok) {
          throw new Error(
            `Uploading Storybook file ${file.relativePath} failed (${uploaded.status}): ${await uploaded.text()}`,
          );
        }
      }),
    );
  }
  const completed = await fetcher(
    `${options.serverUrl}/api/v1/storybook-previews/${manifest.run.id}/complete`,
    { method: "POST", headers: auth },
  );
  if (!completed.ok) {
    throw new Error(
      `Completing Covallaby Storybook preview failed (${completed.status}): ${await completed.text()}`,
    );
  }
  return {
    id: manifest.run.id,
    url: new URL(manifest.url, options.serverUrl).toString(),
    files: files.length,
    captures: capture.captures.length,
    // Default-branch builds come back auto-accepted; PR builds start pending.
    reviewState: manifest.run.reviewState ?? "pending",
    ...(capture.skipped && { captureSkipped: capture.skipped }),
  };
}
