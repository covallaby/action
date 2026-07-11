import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// A malformed action.yml fails at runtime on every consumer's PR (an unquoted
// "statuses: write" in a description once did exactly that), so the manifest
// is validated here, before it can ship.
const manifestPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "action.yml");

describe("action.yml", () => {
  const manifest = parse(readFileSync(manifestPath, "utf8"));

  it("parses and has the required top-level shape", () => {
    expect(manifest.name).toBe("Covallaby");
    expect(manifest.runs).toEqual({
      using: "node24",
      main: "packages/github-action/dist/index.cjs",
    });
  });

  it("declares every input the code reads, each with a string description", () => {
    const expected = [
      "files",
      "format",
      "ignore",
      "strip-prefix",
      "min-project",
      "min-patch",
      "min-new-file",
      "comment",
      "check",
      "breakdown",
      "annotations",
      "statuses",
      "github-token",
      "server-url",
      "server-token",
      "playwright-results",
      "playwright-artifacts",
    ];
    expect(Object.keys(manifest.inputs)).toEqual(expected);
    for (const [name, input] of Object.entries<{ description?: unknown }>(manifest.inputs)) {
      expect(typeof input.description, `input "${name}" description`).toBe("string");
    }
  });

  it("declares the documented outputs", () => {
    expect(Object.keys(manifest.outputs)).toEqual([
      "project-coverage",
      "patch-coverage",
      "uncovered-lines",
      "ok",
      "playback-url",
    ]);
  });
});
