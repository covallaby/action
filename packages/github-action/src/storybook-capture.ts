import { createHash } from "node:crypto";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import puppeteer from "puppeteer-core";

export interface StoryCapture {
  id: string;
  title: string;
  name: string;
  path: string;
  sha256?: string;
}

async function pngsUnder(path: string): Promise<string[]> {
  const info = await stat(path);
  if (info.isFile()) return extname(path).toLowerCase() === ".png" ? [path] : [];
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => pngsUnder(join(path, entry.name))))).flat();
}

export async function prepareComponentCaptures(directory: string): Promise<{
  directory: string;
  captures: StoryCapture[];
  cleanup(): Promise<void>;
}> {
  const source = resolve(directory);
  const paths = (await pngsUnder(source)).sort().slice(0, 250);
  if (paths.length === 0) throw new Error(`Component capture directory ${directory} has no PNGs.`);
  const output = await mkdtemp(join(tmpdir(), "covallaby-component-captures-"));
  await mkdir(join(output, "_covallaby", "captures"), { recursive: true });
  const captures = await Promise.all(
    paths.map(async (path, index) => {
      const fromRoot = relative(source, path).split(sep).join("/");
      const id = fromRoot
        .replace(/\.png$/i, "")
        .replace(/[^a-zA-Z0-9_.-]+/g, "-")
        .toLowerCase();
      const targetName = `${String(index + 1).padStart(3, "0")}-${id}.png`;
      const capturePath = `_covallaby/captures/${targetName}`;
      await copyFile(path, join(output, capturePath));
      return {
        id,
        title: dirname(fromRoot) === "." ? "Components" : dirname(fromRoot).replaceAll("/", " / "),
        name: basename(fromRoot, extname(fromRoot)).replaceAll(/[-_]+/g, " "),
        path: capturePath,
        sha256: createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      };
    }),
  );
  await writeFile(
    join(output, "index.html"),
    "<!doctype html><meta charset=utf-8><title>Covallaby component captures</title><p>Review these captures in Covallaby.</p>",
  );
  await writeFile(
    join(output, "_covallaby", "stories.json"),
    JSON.stringify({ version: 1, stories: captures }, null, 2),
  );
  return {
    directory: output,
    captures,
    cleanup: () => rm(output, { recursive: true, force: true }),
  };
}

const CHROME_CANDIDATES = [
  process.env.COVALLABY_CHROME_PATH,
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter((path): path is string => Boolean(path));

async function chromePath(): Promise<string | null> {
  for (const path of CHROME_CANDIDATES) {
    try {
      await access(path);
      return path;
    } catch {
      // Try the next standard location.
    }
  }
  return null;
}

type IndexEntry = { id?: string; title?: string; name?: string; type?: string };

export async function readStoryIndex(directory: string): Promise<StoryCapture[]> {
  let raw: string;
  try {
    raw = await readFile(join(directory, "index.json"), "utf8");
  } catch {
    try {
      raw = await readFile(join(directory, "stories.json"), "utf8");
    } catch {
      throw new Error(
        `Storybook directory ${directory} has no index.json or stories.json, so individual stories cannot be captured.`,
      );
    }
  }
  const index = JSON.parse(raw) as {
    entries?: Record<string, IndexEntry>;
    stories?: Record<string, IndexEntry>;
  };
  const entries = index.entries ?? index.stories ?? {};
  return Object.entries(entries)
    .map(([key, entry]) => ({
      id: entry.id ?? key,
      title: entry.title ?? "Untitled",
      name: entry.name ?? entry.id ?? key,
      type: entry.type,
    }))
    .filter((entry) => !entry.type || entry.type === "story")
    .map(({ type: _, ...entry }) => ({
      ...entry,
      path: `_covallaby/captures/${entry.id.replace(/[^a-zA-Z0-9_.-]+/g, "-")}.png`,
    }))
    .slice(0, 250);
}

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".mjs": "text/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function serve(directory: string) {
  const root = resolve(directory);
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const requested = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    const fromRoot = relative(root, requested);
    if (fromRoot.startsWith(`..${sep}`) || fromRoot === "..") {
      response.writeHead(403).end();
      return;
    }
    try {
      const data = await readFile(requested);
      response.writeHead(200, {
        "content-type": CONTENT_TYPES[extname(requested)] ?? "application/octet-stream",
      });
      response.end(data);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Could not start Storybook capture server.");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

export async function captureStorybook(
  directory: string,
  mode: "auto" | "required" | "off",
): Promise<{ captures: StoryCapture[]; skipped?: string }> {
  if (mode === "off") return { captures: [], skipped: "disabled" };
  const executablePath = await chromePath();
  if (!executablePath) {
    const message =
      "Chrome was not found. Set COVALLABY_CHROME_PATH or install Chrome/Chromium before the Covallaby step.";
    if (mode === "required") throw new Error(message);
    return { captures: [], skipped: message };
  }
  const captures = await readStoryIndex(directory);
  if (captures.length === 0) throw new Error("Storybook's index contains no captureable stories.");
  const output = join(directory, "_covallaby");
  await rm(output, { recursive: true, force: true });
  await mkdir(join(output, "captures"), { recursive: true });
  const { server, url } = await serve(directory);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    for (let start = 0; start < captures.length; start += 4) {
      await Promise.all(
        captures.slice(start, start + 4).map(async (story) => {
          const page = await browser.newPage();
          try {
            await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
            await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
            await page.goto(
              `${url}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`,
              {
                waitUntil: "domcontentloaded",
                timeout: 30_000,
              },
            );
            const root = await page.waitForSelector("#storybook-root", {
              visible: true,
              timeout: 20_000,
            });
            if (!root) throw new Error(`Story ${story.id} did not render a root element.`);
            await page.addStyleTag({
              content: `
                *, *::before, *::after {
                  animation-delay: 0s !important;
                  animation-duration: 0s !important;
                  caret-color: transparent !important;
                  transition-delay: 0s !important;
                  transition-duration: 0s !important;
                }
              `,
            });
            await page.evaluate(`(async () => {
              await document.fonts.ready;
              await Promise.all([...document.images]
                .filter((image) => !image.complete)
                .map((image) => new Promise((done) => {
                  image.addEventListener("load", done, { once: true });
                  image.addEventListener("error", done, { once: true });
                })));
              await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
            })()`);
            const path = join(directory, story.path);
            await root.screenshot({ path });
            story.sha256 = createHash("sha256")
              .update(await readFile(path))
              .digest("hex");
          } finally {
            await page.close();
          }
        }),
      );
    }
    await writeFile(
      join(output, "stories.json"),
      JSON.stringify({ version: 1, stories: captures }, null, 2),
    );
    return { captures };
  } finally {
    await browser.close();
    await new Promise<void>((resolveClosed, reject) =>
      server.close((error) => (error ? reject(error) : resolveClosed())),
    );
  }
}
