import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve, sep } from "node:path";
import type { ChangedFile, CoverageReport } from "@covallaby/core";

/** Skip embedding sources bigger than this; the report degrades gracefully. */
const MAX_SOURCE_BYTES = 512 * 1024;

export interface HtmlPayload {
  generatedAt: string;
  version: string;
  report: CoverageReport;
  sources: Record<string, string>;
  patch?: ChangedFile[];
}

export function buildPayload(
  report: CoverageReport,
  options: { version: string; sourceRoot: string; patch?: ChangedFile[] },
): HtmlPayload {
  const sources: Record<string, string> = {};
  const root = resolve(options.sourceRoot);
  for (const file of report.files) {
    const full = resolve(root, file.path);
    // Defense in depth: never read outside the source root even if a path
    // slipped past normalization (arbitrary file read from a hostile report).
    if (full !== root && !full.startsWith(root + sep)) continue;
    try {
      if (statSync(full).size > MAX_SOURCE_BYTES) continue;
      sources[file.path] = readFileSync(full, "utf8");
    } catch {
      // Source not available (generated file, different machine) — fine.
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    version: options.version,
    report,
    sources,
    ...(options.patch && { patch: options.patch }),
  };
}

export const PLACEHOLDER = "__COVALLABY_DATA__";

/** Inject the payload into the template, escaping so `</script>` can't break out. */
export function injectPayload(template: string, payload: HtmlPayload): string {
  if (!template.includes(PLACEHOLDER)) {
    throw new Error(
      "The HTML template is missing the data placeholder — rebuild @covallaby/html-report.",
    );
  }
  const json = JSON.stringify(payload).replaceAll("<", "\\u003c");
  return template.replace(PLACEHOLDER, () => json); // callback avoids $-pattern expansion
}

export function defaultTemplatePath(): string {
  const require = createRequire(import.meta.url);
  return require.resolve("@covallaby/html-report/template");
}

export function writeHtmlReport(options: {
  report: CoverageReport;
  outDir: string;
  version: string;
  sourceRoot: string;
  patch?: ChangedFile[];
  templatePath?: string;
}): string {
  const templatePath = options.templatePath ?? defaultTemplatePath();
  const template = readFileSync(templatePath, "utf8");
  const payload = buildPayload(options.report, {
    version: options.version,
    sourceRoot: options.sourceRoot,
    ...(options.patch && { patch: options.patch }),
  });
  const html = injectPayload(template, payload);
  const outFile = join(options.outDir, "index.html");
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html);
  return outFile;
}
