import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadCoverageFiles = vi.hoisted(() => vi.fn().mockResolvedValue(2));
const uploadStorybookPreview = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    id: 9,
    url: "https://app.covallaby.com/r/acme/web/storybook-previews/9",
    files: 3,
    captures: 1,
  }),
);
const cleanup = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const prepareComponentCaptures = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    directory: "/tmp/covallaby-captures",
    captures: [
      {
        id: "button",
        title: "Components",
        name: "button",
        path: "_covallaby/captures/001-button.png",
        sha256: "a".repeat(64),
      },
    ],
    cleanup,
  }),
);

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

vi.mock("../src/storybook.js", () => ({ uploadStorybookPreview }));
vi.mock("../src/storybook-capture.js", () => ({ prepareComponentCaptures }));
vi.mock("../src/coverage-upload.js", () => ({ uploadCoverageFiles }));

describe("run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(inputs)) delete inputs[key];
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

  it("publishes coverage files to the configured hosted server", async () => {
    Object.assign(inputs, {
      files: "packages/parsers/fixtures/lcov/basic.info, packages/parsers/fixtures/lcov/basic.info",
      "server-url": "https://app.covallaby.com",
      "server-token": "secret",
      comment: "update",
      check: "true",
      annotations: "true",
      statuses: "true",
    });
    const core = await import("@actions/core");
    const { run } = await import("../src/main.js");

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
    expect(uploadCoverageFiles).toHaveBeenCalledWith({
      serverUrl: "https://app.covallaby.com",
      token: "secret",
      files: [
        "packages/parsers/fixtures/lcov/basic.info",
        "packages/parsers/fixtures/lcov/basic.info",
      ],
      repo: "acme/web",
      branch: "visuals",
      commit: "abc123",
      pr: 42,
    });
    expect(core.info).toHaveBeenCalledWith("Uploaded 2 coverage files to Covallaby.");
  });

  it("packages and publishes pre-rendered component captures", async () => {
    inputs["playwright-results"] = "";
    inputs["playwright-artifacts"] = "";
    inputs["component-captures"] = ".lostpixel/current";
    const core = await import("@actions/core");
    const { run } = await import("../src/main.js");

    await run();

    expect(prepareComponentCaptures).toHaveBeenCalledWith(".lostpixel/current");
    expect(uploadStorybookPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: "/tmp/covallaby-captures",
        repo: "acme/web",
        branch: "visuals",
        commit: "abc123",
        pr: 42,
        captureMode: "off",
        captures: expect.arrayContaining([expect.objectContaining({ id: "button" })]),
      }),
    );
    expect(cleanup).toHaveBeenCalledOnce();
    expect(core.setOutput).toHaveBeenCalledWith(
      "storybook-url",
      "https://app.covallaby.com/r/acme/web/storybook-previews/9",
    );
    expect(createComment).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("visual diffs") }),
    );
  });
});
