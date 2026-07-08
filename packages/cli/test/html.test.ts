import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../src/cli.js";
import { PLACEHOLDER, buildPayload, injectPayload } from "../src/html.js";

const lcov = `SF:src/a.ts
DA:1,1
DA:2,0
end_of_record
`;

const template = `<html><script id="covallaby-data" type="application/json">${PLACEHOLDER}</script></html>`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "covallaby-html-"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.exitCode = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("injectPayload", () => {
  it("escapes </script> so sources can't break out of the data tag", () => {
    const payload = buildPayload({ files: [] }, { version: "test", sourceRoot: dir });
    payload.sources["evil.ts"] = "</script><script>alert(1)</script>";
    const html = injectPayload(template, payload);
    expect(html).not.toContain("</script><script>alert(1)");
    expect(html).toContain("\\u003c/script");
    // Round-trips through JSON.parse the way the browser reads it.
    const embedded = html.slice(html.indexOf(">{") + 1, html.lastIndexOf("}</") + 1);
    expect(JSON.parse(embedded).sources["evil.ts"]).toContain("</script>");
  });

  it("fails loudly when the template has no placeholder", () => {
    expect(() =>
      injectPayload(
        "<html></html>",
        buildPayload({ files: [] }, { version: "t", sourceRoot: dir }),
      ),
    ).toThrowError(/placeholder/);
  });
});

describe("buildPayload", () => {
  it("embeds readable sources and skips missing ones", () => {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "a.ts"), "const a = 1;\n");
    const payload = buildPayload(
      {
        files: [
          { path: "src/a.ts", lines: [{ line: 1, hits: 1 }], functions: [], branches: [] },
          { path: "src/gone.ts", lines: [{ line: 1, hits: 0 }], functions: [], branches: [] },
        ],
      },
      { version: "test", sourceRoot: dir },
    );
    expect(payload.sources["src/a.ts"]).toBe("const a = 1;\n");
    expect(payload.sources["src/gone.ts"]).toBeUndefined();
  });
});

describe("covallaby html", () => {
  it("writes a self-contained report with embedded data", async () => {
    const coverage = join(dir, "lcov.info");
    writeFileSync(coverage, lcov);
    const templateFile = join(dir, "template.html");
    writeFileSync(templateFile, template);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "a.ts"), "line one\nline two\n");

    const out = join(dir, "report");
    await run(["html", coverage, "-o", out, "--source-root", dir, "--template", templateFile]);

    expect(process.exitCode).toBeUndefined();
    const html = readFileSync(join(out, "index.html"), "utf8");
    expect(html).not.toContain(PLACEHOLDER);
    expect(html).toContain("src/a.ts");
    expect(html).toContain("line one");
  });
});
