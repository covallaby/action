import { type PatchSummary, checkThresholds, summarize } from "@covallaby/core";
import { parseLcov } from "@covallaby/parsers";
import { describe, expect, it } from "vitest";
import { buildAnnotations, buildStatuses } from "../src/checks.js";

const summary = summarize(parseLcov("SF:src/a.ts\nDA:1,1\nDA:2,1\nDA:3,0\nDA:4,1\nend_of_record"));

const patch: PatchSummary = {
  lines: { covered: 2, total: 5, percent: 40 },
  files: [
    {
      path: "src/a.ts",
      added: false,
      lines: { covered: 2, total: 5, percent: 40 },
      uncovered: [
        [3, 3],
        [10, 12],
      ],
    },
  ],
};

describe("buildStatuses", () => {
  it("includes targets and failure states when thresholds are set", () => {
    const thresholds = { minProject: 70, minPatch: 85 };
    const result = checkThresholds(summary, thresholds, patch);
    expect(buildStatuses(summary, patch, thresholds, result)).toEqual([
      { context: "covallaby/project", state: "success", description: "75.0% (target 70.0%)" },
      { context: "covallaby/patch", state: "failure", description: "40.0% (target 85.0%)" },
    ]);
  });

  it("is informational (success, number only) without thresholds", () => {
    const result = checkThresholds(summary, {}, patch);
    expect(buildStatuses(summary, patch, {}, result)).toEqual([
      { context: "covallaby/project", state: "success", description: "75.0%" },
      { context: "covallaby/patch", state: "success", description: "40.0%" },
    ]);
  });

  it("omits the patch status for docs-only diffs", () => {
    const empty: PatchSummary = { lines: { covered: 0, total: 0, percent: null }, files: [] };
    const statuses = buildStatuses(summary, empty, {}, checkThresholds(summary, {}, empty));
    expect(statuses.map((s) => s.context)).toEqual(["covallaby/project"]);
  });
});

describe("buildAnnotations", () => {
  it("annotates each uncovered range with a friendly message", () => {
    const { annotations, remaining } = buildAnnotations(patch);
    expect(remaining).toBe(0);
    expect(annotations).toEqual([
      {
        file: "src/a.ts",
        startLine: 3,
        endLine: 3,
        message: "This changed line isn't covered by a test yet.",
      },
      {
        file: "src/a.ts",
        startLine: 10,
        endLine: 12,
        message: "These 3 changed lines aren't covered by a test yet.",
      },
    ]);
  });

  it("caps output and reports the remainder", () => {
    const big: PatchSummary = {
      lines: { covered: 0, total: 30, percent: 0 },
      files: Array.from({ length: 15 }, (_, i) => ({
        path: `src/f${i}.ts`,
        added: false,
        lines: { covered: 0, total: 2, percent: 0 },
        uncovered: [[1, 2]] as Array<[number, number]>,
      })),
    };
    const { annotations, remaining } = buildAnnotations(big);
    expect(annotations).toHaveLength(10);
    expect(remaining).toBe(5);
  });
});
