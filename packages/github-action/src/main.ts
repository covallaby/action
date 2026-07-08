import { readFileSync } from "node:fs";
import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  type ChangedFile,
  type CoverageReport,
  checkThresholds,
  computePatchCoverage,
  formatPercent,
  mergeReports,
  parseHunks,
  summarize,
} from "@covallaby/core";
import { type CoverageFormat, parseCoverage } from "@covallaby/parsers";
import { buildAnnotations, buildCheckRun, buildStatuses } from "./checks.js";
import { COMMENT_MARKER, type CommentInput, renderComment, renderStepSummary } from "./comment.js";
import { parseInputs } from "./inputs.js";

type Octokit = ReturnType<typeof github.getOctokit>;

function loadReport(
  files: string[],
  format: CoverageFormat | undefined,
  stripPrefix: string,
): CoverageReport {
  const reports = files.map((file) => {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      throw new Error(
        `Couldn't read "${file}". Make sure your test step runs with coverage enabled before Covallaby.`,
      );
    }
    return parseCoverage(content, { ...(format && { format }), stripPrefix });
  });
  return reports.length === 1 ? reports[0]! : mergeReports(reports);
}

async function fetchChangedFiles(octokit: Octokit, prNumber: number): Promise<ChangedFile[]> {
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    ...github.context.repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return files
    .filter((f) => f.status !== "removed")
    .map((f) => ({
      path: f.filename,
      added: f.status === "added",
      lines: f.patch ? parseHunks(f.patch) : [],
    }))
    .filter((f) => f.lines.length > 0);
}

async function upsertComment(octokit: Octokit, prNumber: number, body: string): Promise<void> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    ...github.context.repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const existing = comments.find((c) => c.body?.startsWith(COMMENT_MARKER));
  if (existing) {
    await octokit.rest.issues.updateComment({
      ...github.context.repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      ...github.context.repo,
      issue_number: prNumber,
      body,
    });
  }
}

export async function run(): Promise<void> {
  try {
    const inputs = parseInputs(
      { getInput: (name) => core.getInput(name) },
      process.env.GITHUB_WORKSPACE ?? process.cwd(),
    );

    const report = loadReport(inputs.files, inputs.format, inputs.stripPrefix);
    const summary = summarize(report);
    const fileWord = inputs.files.length === 1 ? "file" : "files";
    core.info(
      `Parsed ${inputs.files.length} coverage ${fileWord}: ${summary.lines.covered}/${summary.lines.total} lines covered (${formatPercent(summary.lines.percent)}).`,
    );

    const prNumber = github.context.payload.pull_request?.number;
    // Only touch the API in PR context — `push` runs and local runs stay offline.
    const octokit = prNumber !== undefined ? github.getOctokit(inputs.githubToken) : null;

    let patch = null;
    if (octokit && prNumber !== undefined) {
      try {
        const changed = await fetchChangedFiles(octokit, prNumber);
        patch = computePatchCoverage(report, changed);
        core.info(`Patch coverage: ${formatPercent(patch.lines.percent)}.`);
      } catch (error) {
        core.warning(
          `Couldn't read the PR diff (${(error as Error).message}); skipping patch coverage.`,
        );
      }
    }

    const result = checkThresholds(summary, inputs.thresholds, patch ?? undefined);
    const commentInput: CommentInput = {
      summary,
      patch,
      thresholds: inputs.thresholds,
      result,
      breakdown: inputs.breakdown,
    };

    core.setOutput("project-coverage", formatPercent(summary.lines.percent).replace("%", ""));
    core.setOutput(
      "patch-coverage",
      patch && patch.lines.percent !== null
        ? formatPercent(patch.lines.percent).replace("%", "")
        : "",
    );
    core.setOutput("uncovered-lines", String(summary.lines.total - summary.lines.covered));
    core.setOutput("ok", String(result.ok));

    await core.summary.addRaw(renderStepSummary(commentInput)).write();

    // Rich Checks-tab entry: title, full markdown report, and annotations.
    const headSha = github.context.payload.pull_request?.head?.sha as string | undefined;
    let checkRunCreated = false;
    if (inputs.check && octokit && headSha) {
      const checkRun = buildCheckRun(summary, patch, inputs.thresholds, result);
      const checkAnnotations = patch ? buildAnnotations(patch, 50).annotations : [];
      try {
        await octokit.rest.checks.create({
          ...github.context.repo,
          name: checkRun.name,
          head_sha: headSha,
          status: "completed",
          conclusion: checkRun.conclusion,
          output: {
            title: checkRun.title,
            summary: renderStepSummary(commentInput),
            annotations: checkAnnotations.map((a) => ({
              path: a.file,
              start_line: a.startLine,
              end_line: a.endLine,
              annotation_level: "warning" as const,
              message: a.message,
            })),
          },
        });
        checkRunCreated = true;
      } catch (error) {
        core.warning(
          `Couldn't create the Covallaby check run (${(error as Error).message}). Grant the job \`checks: write\` permission, or set \`check: false\` to silence this.`,
        );
      }
    }

    // Diff annotations via log commands — only when the check run (which
    // carries richer annotations) didn't land, to avoid duplicates.
    if (inputs.annotations && !checkRunCreated && patch) {
      const { annotations, remaining } = buildAnnotations(patch);
      for (const a of annotations) {
        core.warning(a.message, {
          title: "Covallaby",
          file: a.file,
          startLine: a.startLine,
          endLine: a.endLine,
        });
      }
      if (remaining > 0) {
        core.notice(
          `…and ${remaining} more uncovered ${remaining === 1 ? "range" : "ranges"} — the full list is in the PR comment and report artifact.`,
          { title: "Covallaby" },
        );
      }
    }

    // Named entries in the PR checks list, individually requirable.
    if (inputs.statuses && octokit && headSha) {
      for (const status of buildStatuses(summary, patch, inputs.thresholds, result)) {
        try {
          await octokit.rest.repos.createCommitStatus({
            ...github.context.repo,
            sha: headSha,
            context: status.context,
            state: status.state,
            description: status.description,
          });
        } catch (error) {
          core.warning(
            `Couldn't create the ${status.context} status (${(error as Error).message}). Grant the job \`statuses: write\` permission, or set \`statuses: false\` to silence this.`,
          );
          break; // one failure means the rest will fail too
        }
      }
    }

    if (octokit && prNumber !== undefined && inputs.comment === "update") {
      try {
        await upsertComment(octokit, prNumber, renderComment(commentInput));
      } catch (error) {
        // Fork PRs get a read-only token — never fail the build over a comment.
        core.warning(
          `Couldn't post the PR comment (${(error as Error).message}). If this is a fork PR this is expected; the Step Summary above has the full report.`,
        );
      }
    }

    if (!result.ok) {
      core.setFailed(
        result.failures.map((f) => [f.message, f.hint].filter(Boolean).join(" ")).join("\n"),
      );
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}
