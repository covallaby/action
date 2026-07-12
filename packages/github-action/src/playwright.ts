import { createReadStream } from "node:fs";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve, sep } from "node:path";

export interface PlaybackOptions {
  serverUrl: string;
  token: string;
  resultsPath: string;
  artifactPaths: string[];
  repo: string;
  branch: string;
  commit: string;
  pr: number | null;
  fetch?: typeof globalThis.fetch;
}

interface ArtifactFile {
  path?: string;
  body?: Buffer;
  name: string;
  kind: string;
  contentType: string;
  sizeBytes: number;
  testName: string | null;
}

interface PlaywrightAttachment {
  name?: string;
  contentType?: string;
  path?: string;
  body?: string;
}
interface PlaywrightResult {
  status?: string;
  duration?: number;
  attachments?: PlaywrightAttachment[];
}
interface PlaywrightTest {
  results?: PlaywrightResult[];
}
interface PlaywrightSpec {
  title?: string;
  tests?: PlaywrightTest[];
}
interface PlaywrightSuite {
  title?: string;
  specs?: PlaywrightSpec[];
  suites?: PlaywrightSuite[];
}
interface PlaywrightJson {
  suites?: PlaywrightSuite[];
}

const MIME: Record<string, string> = {
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".zip": "application/zip",
  ".json": "application/json",
  ".html": "text/html",
};
const kindOf = (path: string, contentType?: string): string => {
  if (contentType?.startsWith("image/")) return "screenshot";
  if (contentType?.startsWith("video/")) return "video";
  if (contentType === "application/zip" && basename(path).includes("trace")) return "trace";
  if (contentType === "application/json") return "results";
  const ext = extname(path).toLowerCase();
  if (ext === ".webm" || ext === ".mp4") return "video";
  if ([".png", ".jpg", ".jpeg"].includes(ext)) return "screenshot";
  if (ext === ".zip" && basename(path).includes("trace")) return "trace";
  if (ext === ".html") return "report";
  if (ext === ".json") return "results";
  return "other";
};

const isWithin = (path: string, root: string): boolean => {
  const fromRoot = relative(root, path);
  return (
    fromRoot === "" ||
    (fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`) && !isAbsolute(fromRoot))
  );
};

async function filesUnder(path: string, root = path): Promise<string[]> {
  const actual = await realpath(path);
  if (!isWithin(actual, root)) return [];
  const info = await stat(actual);
  if (info.isFile()) return [actual];
  const entries = await readdir(actual, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => filesUnder(resolve(actual, entry.name), root)),
  );
  return nested.flat();
}

function testMetadata(json: PlaywrightJson): {
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  names: Map<string, string>;
  inline: Array<{ name: string; contentType: string; body: Buffer; testName: string }>;
} {
  const names = new Map<string, string>();
  const inline: Array<{ name: string; contentType: string; body: Buffer; testName: string }> = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let durationMs = 0;
  const visitSuite = (suite: PlaywrightSuite, parents: string[] = []) => {
    const next = suite.title ? [...parents, suite.title] : parents;
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests ?? []) {
        const title = [...next, spec.title].filter(Boolean).join(" › ");
        const results = test.results ?? [];
        const final = results.at(-1);
        if (final?.status === "passed") passed++;
        else if (final?.status === "skipped") skipped++;
        else failed++;
        for (const result of results) {
          durationMs += Number(result.duration) || 0;
          for (const attachment of result.attachments ?? []) {
            if (attachment.path) names.set(resolve(attachment.path), title);
            else if (attachment.body && attachment.name && attachment.contentType) {
              const extension =
                attachment.contentType === "image/png"
                  ? ".png"
                  : attachment.contentType === "image/jpeg"
                    ? ".jpg"
                    : attachment.contentType === "application/json"
                      ? ".json"
                      : "";
              inline.push({
                name: extname(attachment.name) ? attachment.name : `${attachment.name}${extension}`,
                contentType: attachment.contentType,
                body: Buffer.from(attachment.body, "base64"),
                testName: title,
              });
            }
          }
        }
      }
    for (const child of suite.suites ?? []) visitSuite(child, next);
  };
  for (const suite of json.suites ?? []) visitSuite(suite);
  return { passed, failed, skipped, durationMs, names, inline };
}

export async function uploadPlaywrightRun(
  options: PlaybackOptions,
): Promise<{ id: number; url: string; artifacts: number }> {
  const fetcher = options.fetch ?? globalThis.fetch;
  const resultsPath = resolve(options.resultsPath);
  const results = JSON.parse(await readFile(resultsPath, "utf8")) as PlaywrightJson;
  const meta = testMetadata(results);
  const discovered = new Set<string>([await realpath(resultsPath)]);
  const roots = await Promise.all(options.artifactPaths.map((path) => realpath(resolve(path))));
  for (const root of roots) for (const file of await filesUnder(root)) discovered.add(file);
  const attachmentNames = new Map<string, string>();
  for (const [path, testName] of meta.names) {
    try {
      const actual = await realpath(path);
      if (roots.some((root) => isWithin(actual, root))) {
        discovered.add(actual);
        attachmentNames.set(actual, testName);
      }
    } catch {
      // Missing attachments are not useful artifacts and should not fail the run.
    }
  }
  const files: ArtifactFile[] = [];
  for (const path of discovered) {
    const info = await stat(path);
    files.push({
      path,
      name: basename(path),
      kind: kindOf(path),
      contentType: MIME[extname(path).toLowerCase()] ?? "application/octet-stream",
      sizeBytes: info.size,
      testName: attachmentNames.get(path) ?? meta.names.get(path) ?? null,
    });
  }
  for (const attachment of meta.inline) {
    files.push({
      body: attachment.body,
      name: attachment.name,
      kind: kindOf(attachment.name, attachment.contentType),
      contentType: attachment.contentType,
      sizeBytes: attachment.body.byteLength,
      testName: attachment.testName,
    });
  }
  const auth = { authorization: `Bearer ${options.token}` };
  const created = await fetcher(`${options.serverUrl}/api/v1/test-runs`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({
      repo: options.repo,
      branch: options.branch,
      commit: options.commit,
      pr: options.pr,
      framework: "playwright",
      testsPassed: meta.passed,
      testsFailed: meta.failed,
      testsSkipped: meta.skipped,
      durationMs: meta.durationMs,
      artifacts: files.map(({ path: _, body: __, ...file }) => file),
    }),
  });
  if (!created.ok)
    throw new Error(
      `Covallaby playback manifest failed (${created.status}): ${await created.text()}`,
    );
  const manifest = (await created.json()) as {
    run: { id: number };
    artifacts: Array<{ uploadUrl: string }>;
    url: string;
  };
  if (manifest.artifacts.length !== files.length) {
    throw new Error(
      `Covallaby returned ${manifest.artifacts.length} upload URLs for ${files.length} artifacts.`,
    );
  }
  const serverOrigin = new URL(options.serverUrl).origin;
  for (let start = 0; start < files.length; start += 4) {
    await Promise.all(
      files.slice(start, start + 4).map(async (file, offset) => {
        const target = manifest.artifacts[start + offset]!;
        const targetUrl = new URL(target.uploadUrl, `${options.serverUrl}/`);
        const localUpload = targetUrl.origin === serverOrigin;
        const uploaded = await fetcher(targetUrl.toString(), {
          method: "PUT",
          headers: {
            "content-type": file.contentType,
            "content-length": String(file.sizeBytes),
            ...(localUpload ? auth : {}),
          },
          body: (file.body ?? createReadStream(file.path!)) as never,
          duplex: "half",
        } as RequestInit);
        if (!uploaded.ok)
          throw new Error(
            `Uploading ${file.name} failed (${uploaded.status}): ${await uploaded.text()}`,
          );
      }),
    );
  }
  const completed = await fetcher(
    `${options.serverUrl}/api/v1/test-runs/${manifest.run.id}/complete`,
    { method: "POST", headers: auth },
  );
  if (!completed.ok)
    throw new Error(
      `Completing Covallaby playback failed (${completed.status}): ${await completed.text()}`,
    );
  return {
    id: manifest.run.id,
    url: new URL(manifest.url, options.serverUrl).toString(),
    artifacts: files.length,
  };
}
