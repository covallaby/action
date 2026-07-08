import type { Thresholds } from "@covallaby/core";
import { COVERAGE_FORMATS, type CoverageFormat } from "@covallaby/parsers";

export interface ActionInputs {
  files: string[];
  format?: CoverageFormat;
  stripPrefix: string;
  thresholds: Thresholds;
  comment: "update" | "off";
  annotations: boolean;
  statuses: boolean;
  githubToken: string;
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
  if (files.length === 0) {
    throw new Error(
      "`files` is required — point it at your coverage output, e.g. coverage/lcov.info.",
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

  return {
    files,
    ...(format !== "" && { format: format as CoverageFormat }),
    stripPrefix: raw.getInput("strip-prefix").trim() || workspace,
    thresholds,
    comment,
    annotations: parseSwitch(raw.getInput("annotations"), "annotations", true),
    statuses: parseSwitch(raw.getInput("statuses"), "statuses", true),
    githubToken: raw.getInput("github-token"),
  };
}
