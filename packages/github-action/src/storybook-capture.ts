import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, relative, resolve, sep } from "node:path";
import puppeteer from "puppeteer-core";

export interface StoryCapture {
  id: string;
  title: string;
  name: string;
  path: string;
  sha256?: string;
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
