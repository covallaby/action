import { type PatchSummary, checkThresholds, summarize } from "@covallaby/core";
import { parseLcov } from "@covallaby/parsers";
import { describe, expect, it } from "vitest";
import {
  buildAnnotations,
  buildCheckRun,
  buildComponentsStatus,
  buildJourneysStatus,
  buildStatuses,
} from "../src/checks.js";

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

  it("deep-links every coverage status to the hosted upload page", () => {
    const url = "https://app.covallaby.com/r/acme/app/u/12";
    const result = checkThresholds(summary, {}, patch);
    for (const status of buildStatuses(summary, patch, {}, result, url)) {
      expect(status.targetUrl).toBe(url);
    }
  });
});

describe("buildJourneysStatus", () => {
  const url = "https://app.covallaby.com/r/acme/app/test-runs/42";

  it("passes with the run's outcome and deep link", () => {
    expect(buildJourneysStatus({ url, tests: { passed: 8, failed: 0, skipped: 2 } })).toEqual({
      context: "covallaby/journeys",
      state: "success",
      description: "8 journeys passed (2 skipped)",
      targetUrl: url,
    });
  });

  it("fails when any journey failed", () => {
    expect(buildJourneysStatus({ url, tests: { passed: 6, failed: 2, skipped: 0 } })).toEqual({
      context: "covallaby/journeys",
      state: "failure",
      description: "2 of 8 journeys failed",
      targetUrl: url,
    });
  });
});

describe("buildComponentsStatus", () => {
  const url = "https://app.covallaby.com/r/acme/app/storybook-previews/9";

  it("is pending while captures await review", () => {
    expect(buildComponentsStatus({ url, captures: 3, reviewState: "pending" })).toEqual({
      context: "covallaby/components",
      state: "pending",
      description: "3 component captures await visual review",
      targetUrl: url,
    });
  });

  it("fails on rejection and succeeds on approval or mainline auto-accept", () => {
    expect(buildComponentsStatus({ url, captures: 3, reviewState: "rejected" }).state).toBe(
      "failure",
    );
    expect(buildComponentsStatus({ url, captures: 3, reviewState: "approved" }).state).toBe(
      "success",
    );
    expect(buildComponentsStatus({ url, captures: 3, reviewState: "auto-accepted" }).state).toBe(
      "success",
    );
  });

  it("succeeds when a build shipped without captures — nothing to review", () => {
    const status = buildComponentsStatus({ url, captures: 0, reviewState: "pending" });
    expect(status.state).toBe("success");
    expect(status.description).toContain("no captures");
  });
});

describe("buildCheckRun", () => {
  it("summarizes a failure with the gap that matters", () => {
    const thresholds = { minPatch: 85 };
    const run = buildCheckRun(
      summary,
      patch,
      thresholds,
      checkThresholds(summary, thresholds, patch),
    );
    expect(run).toEqual({
      name: "Covallaby",
      conclusion: "failure",
      title: "patch 40.0% · project 75.0% — patch needs 85.0%",
    });
  });

  it("celebrates success", () => {
    const run = buildCheckRun(summary, patch, {}, checkThresholds(summary, {}, patch));
    expect(run.conclusion).toBe("success");
    expect(run.title).toBe("You're covered — patch 40.0% · project 75.0%");
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
