import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "scripts", "fixtures");
const generated = join(source, ".generated");
const target = join(root, "packages", "github-action", "test", "fixtures", "playwright");

await rm(generated, { recursive: true, force: true });
await rm(target, { recursive: true, force: true });
const result = spawnSync(
  join(root, "node_modules", ".bin", "playwright"),
  ["test", "--config", join(source, "playwright.config.ts")],
  { cwd: source, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);

async function filesUnder(path) {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const child = join(path, entry.name);
        return entry.isDirectory() ? filesUnder(child) : [child];
      }),
    )
  ).flat();
}

const generatedFiles = await filesUnder(generated);
const one = (extension) => {
  const found = generatedFiles.find((path) => extname(path) === extension);
  if (!found) throw new Error(`Playwright did not generate a ${extension} fixture.`);
  return found;
};
await mkdir(join(target, "html-report"), { recursive: true });
await cp(one(".webm"), join(target, "video.webm"));
await cp(one(".png"), join(target, "screenshot.png"));
await cp(one(".zip"), join(target, "trace.zip"));
await cp(join(generated, "html-report", "index.html"), join(target, "html-report", "index.html"));

const report = JSON.parse(await readFile(join(generated, "results.json"), "utf8"));
report.config.argv = ["node", "@playwright/test/cli", "test", "--config", "playwright.config.ts"];
report.config.configFile = "playwright.config.ts";
report.config.rootDir = "scripts/fixtures";
for (const project of report.config.projects ?? []) {
  project.outputDir = ".generated/results";
  project.testDir = "scripts/fixtures";
}
for (const suite of report.suites ?? [])
  for (const spec of suite.specs ?? [])
    for (const test of spec.tests ?? [])
      for (const run of test.results ?? []) {
        run.startTime = "2000-01-01T00:00:00.000Z";
        for (const attachment of run.attachments ?? []) {
          attachment.path = `packages/github-action/test/fixtures/playwright/${
            attachment.name === "screenshot"
              ? "screenshot.png"
              : attachment.name === "video"
                ? "video.webm"
                : "trace.zip"
          }`;
        }
      }
report.stats.startTime = "2000-01-01T00:00:00.000Z";
await writeFile(join(target, "results.json"), `${JSON.stringify(report, null, 2)}\n`);

const fixtureFiles = await filesUnder(target);
const checksums = {};
for (const path of fixtureFiles) {
  checksums[path.slice(target.length + 1)] = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}
const playwright = JSON.parse(
  await readFile(join(root, "node_modules", "@playwright", "test", "package.json"), "utf8"),
).version;
await writeFile(
  join(target, "manifest.json"),
  `${JSON.stringify({ generatedBy: `@playwright/test@${playwright}`, checksums }, null, 2)}\n`,
);
await rm(generated, { recursive: true, force: true });
