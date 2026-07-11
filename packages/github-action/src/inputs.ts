import type { Thresholds } from "@covallaby/core";
import { COVERAGE_FORMATS, type CoverageFormat } from "@covallaby/parsers";

export interface ActionInputs {
  files: string[];
  ignore: string[];
  format?: CoverageFormat;
  stripPrefix: string;
  thresholds: Thresholds;
  comment: "update" | "off";
  check: boolean;
  annotations: boolean;
  breakdown: number | "auto" | "off";
  statuses: boolean;
  githubToken: string;
  serverUrl?: string;
  serverToken?: string;
  playwrightResults?: string;
  playwrightArtifacts: string[];
  storybookDir?: string;
}

export interface RawInputs {
  getInput(name: string): string;
}

function parseSwitch(raw: string, name: string, fallback: boolean): boolean {
  const value = raw.trim().toLowerCase();
  if (value === "") return fallback;
  if (value === "true" || value === "on") return true;
  if (value === "false" || value === "off") return false;
  throw new Error(`\`${name}\` must be "true" or "false", got "${raw}".`);
}

function parseBreakdown(raw: string): number | "auto" | "off" {
  const value = raw.trim().toLowerCase();
  if (value === "" || value === "auto") return "auto";
  if (value === "off") return "off";
  const depth = Number(value);
  if (Number.isInteger(depth) && depth >= 1) return depth;
  throw new Error(`\`breakdown\` must be "auto", "off", or a directory depth (1+), got "${raw}".`);
}

function parsePercent(raw: string, name: string): number | undefined {
  if (raw === "") return undefined;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0 || value > 100) {
    throw new Error(`\`${name}\` must be a number between 0 and 100, got "${raw}".`);
  }
  return value;
}

export function parseInputs(raw: RawInputs, workspace: string): ActionInputs {
  const files = raw
    .getInput("files")
    .split(/[\n,]/)
    .map((f) => f.trim())
    .filter((f) => f !== "");
  const playwrightResults = raw.getInput("playwright-results").trim();
  const storybookDir = raw.getInput("storybook-dir").trim();
  if (files.length === 0 && playwrightResults === "" && storybookDir === "") {
    throw new Error(
      "Set `files` for coverage, `playwright-results` for browser playback, or `storybook-dir` for a Storybook preview.",
    );
  }

  const format = raw.getInput("format").trim();
  if (format !== "" && !COVERAGE_FORMATS.includes(format as CoverageFormat)) {
    throw new Error(
      `Unsupported format "${format}". Covallaby understands: ${COVERAGE_FORMATS.join(", ")}.`,
    );
  }

  const comment = raw.getInput("comment").trim() || "update";
  if (comment !== "update" && comment !== "off") {
    throw new Error(`\`comment\` must be "update" or "off", got "${comment}".`);
  }

  const thresholds: Thresholds = {};
  const minProject = parsePercent(raw.getInput("min-project").trim(), "min-project");
  const minPatch = parsePercent(raw.getInput("min-patch").trim(), "min-patch");
  const minNewFile = parsePercent(raw.getInput("min-new-file").trim(), "min-new-file");
  if (minProject !== undefined) thresholds.minProject = minProject;
  if (minPatch !== undefined) thresholds.minPatch = minPatch;
  if (minNewFile !== undefined) thresholds.minNewFile = minNewFile;
  if (files.length === 0 && Object.keys(thresholds).length > 0) {
    throw new Error("Coverage thresholds require at least one `files` input.");
  }

  const ignore = raw
    .getInput("ignore")
    .split(/[\n,]/)
    .map((p) => p.trim())
    .filter((p) => p !== "");

  return {
    files,
    ignore,
    ...(format !== "" && { format: format as CoverageFormat }),
    stripPrefix: raw.getInput("strip-prefix").trim() || workspace,
    thresholds,
    comment,
    check: parseSwitch(raw.getInput("check"), "check", true),
    breakdown: parseBreakdown(raw.getInput("breakdown")),
    annotations: parseSwitch(raw.getInput("annotations"), "annotations", true),
    statuses: parseSwitch(raw.getInput("statuses"), "statuses", true),
    githubToken: raw.getInput("github-token"),
    ...(raw.getInput("server-url").trim() && {
      serverUrl: raw.getInput("server-url").trim().replace(/\/+$/, ""),
    }),
    ...(raw.getInput("server-token").trim() && {
      serverToken: raw.getInput("server-token").trim(),
    }),
    ...(playwrightResults && { playwrightResults }),
    playwrightArtifacts: raw
      .getInput("playwright-artifacts")
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter(Boolean),
    ...(storybookDir && { storybookDir }),
  };
}
