import {
  type PatchSummary,
  type ReportSummary,
  checkThresholds,
  computePatchCoverage,
  parseUnifiedDiff,
  summarize,
} from "@covallaby/core";
import { parseLcov } from "@covallaby/parsers";
import { describe, expect, it } from "vitest";
import { COMMENT_MARKER, renderComment, renderStepSummary } from "../src/comment.js";
import { parseInputs } from "../src/inputs.js";

const lcov = `SF:src/payment.ts
DA:41,1
DA:42,0
DA:44,0
DA:45,0
DA:82,1
end_of_record
SF:src/checkout.ts
DA:88,0
DA:89,1
end_of_record
`;

const diff = `diff --git a/src/payment.ts b/src/payment.ts
--- a/src/payment.ts
+++ b/src/payment.ts
@@ -40,6 +40,6 @@
 ctx
+l41
+l42
 ctx
+l44
+l45
diff --git a/src/checkout.ts b/src/checkout.ts
--- a/src/checkout.ts
+++ b/src/checkout.ts
@@ -87,2 +87,3 @@
 ctx
+l88
 ctx
`;

function build(thresholds: Parameters<typeof checkThresholds>[1]) {
  const report = parseLcov(lcov);
  const summary: ReportSummary = summarize(report);
  const patch: PatchSummary = computePatchCoverage(report, parseUnifiedDiff(diff));
  const result = checkThresholds(summary, thresholds, patch);
  return { summary, patch, thresholds, result };
}

describe("renderComment", () => {
  it("renders a failing report with things to look at", () => {
    const comment = renderComment(build({ minPatch: 85 }));
    expect(comment).toMatchSnapshot();
    expect(comment.startsWith(COMMENT_MARKER)).toBe(true);
    expect(comment).toContain("look at before merging");
    expect(comment).toContain("`src/payment.ts:42, 44-45`");
    expect(comment).toContain("| Patch coverage | 20.0% |");
  });

  it("celebrates a passing report", () => {
    const comment = renderComment(build({}));
    expect(comment).toContain("You're covered.");
    expect(comment).not.toContain("⚠️");
  });

  it("omits the marker from the step summary", () => {
    expect(renderStepSummary(build({}))).not.toContain(COMMENT_MARKER);
  });

  it("links the hosted browser playback from the sticky comment", () => {
    const comment = renderComment({
      ...build({}),
      playback: { url: "https://app.covallaby.com/r/acme/app/test-runs/42", artifacts: 7 },
    });
    expect(comment).toContain("### Browser playback");
    expect(comment).toContain(
      "[Watch this run in Covallaby](https://app.covallaby.com/r/acme/app/test-runs/42)",
    );
    expect(comment).toContain("7 artifacts");
  });
});

describe("parseInputs", () => {
  const raw = (values: Record<string, string>) => ({
    getInput: (name: string) => values[name] ?? "",
  });

  it("parses files, thresholds, and defaults", () => {
    const inputs = parseInputs(
      raw({ files: "a.info, b.info\nc.info", "min-patch": "85", "github-token": "t" }),
      "/workspace",
    );
    expect(inputs.files).toEqual(["a.info", "b.info", "c.info"]);
    expect(inputs.thresholds).toEqual({ minPatch: 85 });
    expect(inputs.stripPrefix).toBe("/workspace");
    expect(inputs.comment).toBe("update");
  });

  it("rejects nonsense thresholds and formats with friendly errors", () => {
    expect(() => parseInputs(raw({ files: "a", "min-project": "banana" }), "/w")).toThrowError(
      /between 0 and 100/,
    );
    expect(parseInputs(raw({ files: "a", format: "jacoco" }), "/w").format).toBe("jacoco");
    expect(() => parseInputs(raw({ files: "a", format: "clover" }), "/w")).toThrowError(
      /understands: lcov, jacoco, cobertura, xccov/,
    );
    expect(() => parseInputs(raw({ files: " " }), "/w")).toThrowError(/`files` is required/);
  });

  it("parses hosted Playwright inputs without retaining a trailing slash", () => {
    const inputs = parseInputs(
      raw({
        files: "coverage.info",
        "server-url": "https://app.covallaby.com///",
        "server-token": " secret ",
        "playwright-results": " results.json ",
        "playwright-artifacts": "test-results, playwright-report\ntrace.zip",
        "storybook-dir": " storybook-static ",
      }),
      "/w",
    );
    expect(inputs.serverUrl).toBe("https://app.covallaby.com");
    expect(inputs.serverToken).toBe("secret");
    expect(inputs.playwrightResults).toBe("results.json");
    expect(inputs.playwrightArtifacts).toEqual(["test-results", "playwright-report", "trace.zip"]);
    expect(inputs.storybookDir).toBe("storybook-static");
  });

  it("links a hosted Storybook preview from the sticky comment", () => {
    const comment = renderComment({
      ...build({}),
      storybook: { url: "https://app.covallaby.com/r/acme/app/storybook-previews/8", files: 42 },
    });
    expect(comment).toContain("### Storybook preview");
    expect(comment).toContain("[Explore this build in Covallaby]");
    expect(comment).toContain("42 files");
  });
});

describe("renderComment path safety", () => {
  it("neutralizes backticks and pipes in coverage file paths", () => {
    const report = parseLcov("SF:evil`](http://x)|.ts\nDA:1,0\nDA:2,0\nend_of_record");
    const summary = summarize(report);
    const patch = computePatchCoverage(report, [
      { path: "evil`](http://x)|.ts", added: false, lines: [1, 2] },
    ]);
    const comment = renderComment({
      summary,
      patch,
      thresholds: { minPatch: 90 },
      result: checkThresholds(summary, { minPatch: 90 }, patch),
    });
    expect(comment).not.toContain("`](http://x)");
    expect(comment).not.toMatch(/\|.*evil/);
  });
});
