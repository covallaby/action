import { writeFileSync } from "node:fs";
import { checkThresholds, formatPercent, renderBadge, summarize } from "@covallaby/core";
import { type CoverageFormat, ParseError, detectFormat } from "@covallaby/parsers";
import { Command } from "commander";
import pc from "picocolors";
import { loadReports } from "./load.js";
import { renderReport, reportJson } from "./render.js";

interface CommonOptions {
  format?: CoverageFormat;
  stripPrefix?: string;
  json?: boolean;
}

function loadOptions(opts: CommonOptions) {
  return {
    ...(opts.format !== undefined && { format: opts.format }),
    ...(opts.stripPrefix !== undefined && { stripPrefix: opts.stripPrefix }),
  };
}

function addCommonOptions(cmd: Command): Command {
  return cmd
    .option("--format <format>", "coverage format (default: auto-detect). Supported: lcov")
    .option("--strip-prefix <prefix>", "path prefix to strip so paths are repo-relative")
    .option("--json", "print machine-readable JSON instead of human output");
}

export function buildProgram(): Command {
  const program = new Command("covallaby")
    .description("Beautiful coverage reports for your pull requests.")
    .version("0.1.0")
    .configureOutput({
      outputError: (str, write) => write(pc.red(str)),
    });

  addCommonOptions(
    program
      .command("report")
      .description("Summarize coverage: totals, percentages, and lines that need love")
      .argument("<files...>", "coverage files (e.g. coverage/lcov.info)"),
  ).action((files: string[], opts: CommonOptions) => {
    const report = loadReports(files, loadOptions(opts));
    const summary = summarize(report);
    if (opts.json) {
      console.log(JSON.stringify(reportJson(summary), null, 2));
    } else {
      console.log(renderReport(report, summary));
    }
  });

  addCommonOptions(
    program
      .command("check")
      .description("Check coverage against thresholds; exits non-zero with a helpful message")
      .argument("<files...>", "coverage files")
      .requiredOption(
        "--min-project <percent>",
        "minimum project line coverage",
        Number.parseFloat,
      ),
  ).action((files: string[], opts: CommonOptions & { minProject: number }) => {
    if (Number.isNaN(opts.minProject) || opts.minProject < 0 || opts.minProject > 100) {
      throw new Error("--min-project must be a number between 0 and 100.");
    }
    const summary = summarize(loadReports(files, loadOptions(opts)));
    const result = checkThresholds(summary, { minProject: opts.minProject });
    if (opts.json) {
      console.log(
        JSON.stringify(
          { ok: result.ok, failures: result.failures, ...reportJson(summary) },
          null,
          2,
        ),
      );
    } else if (result.ok) {
      console.log(
        pc.green(
          `✓ You're covered. Project coverage is ${formatPercent(summary.lines.percent)} (required: ${formatPercent(opts.minProject)}).`,
        ),
      );
    } else {
      for (const failure of result.failures) {
        console.error(pc.red(`✗ ${failure.message}`));
      }
    }
    if (!result.ok) process.exitCode = 1;
  });

  addCommonOptions(
    program
      .command("badge")
      .description("Generate a flat SVG coverage badge")
      .argument("<files...>", "coverage files")
      .option("-o, --output <path>", "write the SVG here instead of stdout")
      .option("--label <text>", "badge label", "coverage"),
  ).action((files: string[], opts: CommonOptions & { output?: string; label: string }) => {
    const summary = summarize(loadReports(files, loadOptions(opts)));
    const svg = renderBadge(summary.lines.percent, opts.label);
    if (opts.output) {
      writeFileSync(opts.output, svg);
      console.log(pc.dim(`Badge written to ${opts.output}`));
    } else {
      process.stdout.write(svg);
    }
  });

  addCommonOptions(
    program
      .command("validate")
      .description("Check that coverage files exist, parse, and look sane")
      .argument("<files...>", "coverage files"),
  ).action((files: string[], opts: CommonOptions) => {
    const results = files.map((file) => {
      try {
        const report = loadReports([file], loadOptions(opts));
        const summary = summarize(report);
        return {
          file,
          ok: true as const,
          format: opts.format ?? "lcov",
          files: summary.totalFiles,
          lines: summary.lines.total,
        };
      } catch (error) {
        return { file, ok: false as const, error: (error as Error).message };
      }
    });
    if (opts.json) {
      console.log(JSON.stringify({ ok: results.every((r) => r.ok), results }, null, 2));
    } else {
      for (const r of results) {
        if (r.ok) {
          console.log(
            pc.green(`✓ ${r.file}`) +
              pc.dim(` — ${r.format}, ${r.files} files, ${r.lines} coverable lines`),
          );
        } else {
          console.error(pc.red(`✗ ${r.file} — ${r.error}`));
        }
      }
    }
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  });

  return program;
}

export async function run(argv: string[]): Promise<void> {
  const program = buildProgram();
  try {
    await program.parseAsync(argv, { from: "user" });
  } catch (error) {
    if (error instanceof ParseError || error instanceof Error) {
      console.error(pc.red(`✗ ${error.message}`));
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

export { detectFormat };
