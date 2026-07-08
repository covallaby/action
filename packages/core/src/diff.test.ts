import { describe, expect, it } from "vitest";
import { computePatchCoverage, matchCoveragePaths, parseHunks, parseUnifiedDiff } from "./diff.js";
import type { CoverageReport } from "./model.js";

describe("parseHunks", () => {
  it("extracts new-side line numbers of added lines", () => {
    const patch = `@@ -10,3 +10,5 @@ function pay() {
 context
+added line 11
+added line 12
 context
-removed
+added line 14`;
    expect(parseHunks(patch)).toEqual([11, 12, 14]);
  });

  it("handles multiple hunks and no-newline markers", () => {
    const patch = `@@ -1 +1,2 @@
+first
 old
@@ -20,2 +21,2 @@
-gone
+replaced
 tail
\\ No newline at end of file`;
    expect(parseHunks(patch)).toEqual([1, 21]);
  });
});

describe("parseUnifiedDiff", () => {
  const diff = `diff --git a/src/payment.ts b/src/payment.ts
index 111..222 100644
--- a/src/payment.ts
+++ b/src/payment.ts
@@ -40,4 +40,6 @@
 context
+new 41
+new 42
 context
 context
@@ -80,1 +82,1 @@
-old
+new 82
diff --git a/src/fresh.ts b/src/fresh.ts
new file mode 100644
--- /dev/null
+++ b/src/fresh.ts
@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3
diff --git a/src/gone.ts b/src/gone.ts
deleted file mode 100644
--- a/src/gone.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-bye
-bye
`;

  it("collects changed lines per file and detects added files", () => {
    const files = parseUnifiedDiff(diff);
    expect(files).toEqual([
      { path: "src/payment.ts", added: false, lines: [41, 42, 82] },
      { path: "src/fresh.ts", added: true, lines: [1, 2, 3] },
    ]);
  });
});

describe("computePatchCoverage", () => {
  const report: CoverageReport = {
    files: [
      {
        path: "src/payment.ts",
        lines: [
          { line: 41, hits: 1 },
          { line: 42, hits: 0 },
          { line: 82, hits: 0 },
        ],
        functions: [],
        branches: [],
      },
      {
        path: "src/fresh.ts",
        lines: [
          { line: 1, hits: 1 },
          { line: 3, hits: 1 },
        ],
        functions: [],
        branches: [],
      },
    ],
  };

  it("intersects changed lines with coverable lines", () => {
    const patch = computePatchCoverage(report, [
      { path: "src/payment.ts", added: false, lines: [41, 42, 43, 82] }, // 43 not executable
      { path: "src/fresh.ts", added: true, lines: [1, 2, 3] }, // 2 not executable
      { path: "README.md", added: false, lines: [1] }, // not covered at all
    ]);
    expect(patch.lines).toEqual({ covered: 3, total: 5, percent: 60 });
    const payment = patch.files.find((f) => f.path === "src/payment.ts")!;
    expect(payment.uncovered).toEqual([
      [42, 42],
      [82, 82],
    ]);
    const fresh = patch.files.find((f) => f.path === "src/fresh.ts")!;
    expect(fresh.added).toBe(true);
    expect(fresh.lines.percent).toBe(100);
  });

  it("returns null percent for a docs-only change", () => {
    const patch = computePatchCoverage(report, [
      { path: "docs/guide.md", added: false, lines: [1, 2] },
    ]);
    expect(patch.lines.percent).toBeNull();
    expect(patch.files).toEqual([]);
  });
});

describe("matchCoveragePaths (suffix fallback)", () => {
  it("matches JaCoCo package paths to repo paths", () => {
    const m = matchCoveragePaths(
      ["com/example/pay/Payment.java", "com/example/Main.java"],
      ["src/main/java/com/example/pay/Payment.java", "docs/README.md"],
    );
    expect(m.get("src/main/java/com/example/pay/Payment.java")).toBe(
      "com/example/pay/Payment.java",
    );
    expect(m.has("docs/README.md")).toBe(false);
  });

  it("matches Cobertura --cov=pkg (source root dropped)", () => {
    const m = matchCoveragePaths(["payment.py"], ["src/payment.py"]);
    expect(m.get("src/payment.py")).toBe("payment.py");
  });

  it("prefers exact matches and never double-attributes", () => {
    const m = matchCoveragePaths(["a/util.py", "b/util.py"], ["src/a/util.py", "src/b/util.py"]);
    expect(m.get("src/a/util.py")).toBe("a/util.py");
    expect(m.get("src/b/util.py")).toBe("b/util.py");
    expect(new Set(m.values()).size).toBe(2); // no coverage entry reused
  });

  it("skips genuinely ambiguous filename-only matches", () => {
    // one coverage 'util.py' can't be attributed to two changed util.py files
    const m = matchCoveragePaths(["util.py"], ["src/a/util.py", "src/b/util.py"]);
    expect(m.size).toBe(1); // longest-first claims one; the other stays unmatched
  });

  it("computePatchCoverage uses the fallback end to end", () => {
    const report: CoverageReport = {
      files: [
        {
          path: "com/example/Payment.java",
          lines: [
            { line: 5, hits: 1 },
            { line: 6, hits: 0 },
          ],
          functions: [],
          branches: [],
        },
      ],
    };
    const patch = computePatchCoverage(report, [
      { path: "src/main/java/com/example/Payment.java", added: false, lines: [5, 6] },
    ]);
    expect(patch.lines).toEqual({ covered: 1, total: 2, percent: 50 });
  });
});
