import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../src/cli.js";

const lcov = `SF:src/a.ts
DA:1,1
DA:2,1
DA:3,0
DA:4,1
end_of_record
`;

let dir: string;
let file: string;
let logs: string[];
let errors: string[];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "covallaby-"));
  file = join(dir, "lcov.info");
  writeFileSync(file, lcov);
  logs = [];
  errors = [];
  vi.spyOn(console, "log").mockImplementation((msg: string) => logs.push(msg));
  vi.spyOn(console, "error").mockImplementation((msg: string) => errors.push(msg));
  process.exitCode = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("covallaby report", () => {
  it("prints JSON with --json", async () => {
    await run(["report", file, "--json"]);
    const json = JSON.parse(logs.join("\n"));
    expect(json.lines).toEqual({ covered: 3, total: 4, percent: 75 });
  });

  it("fails helpfully when the file is missing", async () => {
    await run(["report", join(dir, "nope.info")]);
    expect(process.exitCode).toBe(1);
    expect(errors.join("\n")).toContain("Run your tests with coverage first");
  });
});

describe("covallaby check", () => {
  it("passes when coverage meets the threshold", async () => {
    await run(["check", file, "--min-project", "70"]);
    expect(process.exitCode).toBeUndefined();
    expect(logs.join("\n")).toContain("You're covered");
  });

  it("fails with an actionable message when below the threshold", async () => {
    await run(["check", file, "--min-project", "90"]);
    expect(process.exitCode).toBe(1);
    const message = errors.join("\n");
    expect(message).toContain("75.0%");
    expect(message).toContain("90.0%");
    expect(message).toContain("src/a.ts");
  });

  it("reports ok in JSON output", async () => {
    await run(["check", file, "--min-project", "90", "--json"]);
    const json = JSON.parse(logs.join("\n"));
    expect(json.ok).toBe(false);
    expect(json.failures[0].kind).toBe("project");
  });
});

describe("covallaby badge", () => {
  it("writes an SVG badge", async () => {
    const out = join(dir, "badge.svg");
    await run(["badge", file, "-o", out]);
    const svg = readFileSync(out, "utf8");
    expect(svg).toContain("<svg");
    expect(svg).toContain("75.0%");
  });
});

describe("covallaby validate", () => {
  it("validates good files and rejects bad ones", async () => {
    const bad = join(dir, "bad.info");
    writeFileSync(bad, "not lcov at all");
    await run(["validate", file, bad, "--json"]);
    const json = JSON.parse(logs.join("\n"));
    expect(json.ok).toBe(false);
    expect(json.results[0].ok).toBe(true);
    expect(json.results[1].ok).toBe(false);
    expect(process.exitCode).toBe(1);
  });
});
