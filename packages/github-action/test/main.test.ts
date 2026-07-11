import { beforeEach, describe, expect, it, vi } from "vitest";

const inputs: Record<string, string> = {};
const addRaw = vi.fn();
const write = vi.fn();
const createComment = vi.fn();

vi.mock("@actions/core", () => ({
  getInput: vi.fn((name: string) => inputs[name] ?? ""),
  setSecret: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  notice: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  summary: { addRaw, write },
}));

vi.mock("@actions/github", () => ({
  context: {
    repo: { owner: "acme", repo: "web" },
    ref: "refs/heads/visuals",
    sha: "abc123",
    payload: { pull_request: { number: 42, head: { ref: "visuals", sha: "abc123" } } },
  },
  getOctokit: vi.fn(() => ({
    paginate: vi.fn().mockResolvedValue([]),
    rest: {
      issues: { listComments: vi.fn(), updateComment: vi.fn(), createComment },
      pulls: { listFiles: vi.fn() },
      checks: { create: vi.fn() },
      repos: { createCommitStatus: vi.fn() },
    },
  })),
}));

vi.mock("../src/playwright.js", () => ({
  uploadPlaywrightRun: vi.fn().mockResolvedValue({
    url: "https://app.covallaby.com/r/acme/web/test-runs/42",
    artifacts: 7,
  }),
}));

vi.mock("../src/storybook.js", () => ({ uploadStorybookPreview: vi.fn() }));

describe("run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(inputs, {
      "server-url": "https://app.covallaby.com",
      "server-token": "secret",
      "playwright-results": "playwright-results.json",
      "playwright-artifacts": "test-results,playwright-report",
      comment: "update",
      check: "true",
      annotations: "true",
      statuses: "true",
    });
    addRaw.mockReturnValue({ write });
    write.mockResolvedValue(undefined);
    createComment.mockResolvedValue(undefined);
  });

  it("publishes a Playwright-only summary and PR comment without coverage checks", async () => {
    const core = await import("@actions/core");
    const { run } = await import("../src/main.js");

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.setOutput).toHaveBeenCalledWith(
      "playback-url",
      "https://app.covallaby.com/r/acme/web/test-runs/42",
    );
    expect(addRaw).toHaveBeenCalledTimes(1);
    expect(addRaw.mock.calls[0]?.[0]).toContain("Your visual test artifacts are ready.");
    expect(addRaw.mock.calls[0]?.[0]).not.toContain("Project coverage");
    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 42,
        body: expect.stringContaining("Browser playback"),
      }),
    );
  });
});
