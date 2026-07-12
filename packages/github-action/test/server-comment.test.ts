import { afterEach, describe, expect, it, vi } from "vitest";
import { publishServerComment } from "../src/server-comment.js";

const input = {
  serverUrl: "https://app.covallaby.com",
  token: "secret",
  repo: "acme/app",
  pr: 42,
  marker: "<!-- covallaby-report:v1 -->",
  body: "<!-- covallaby-report:v1 -->\nreport",
};

describe("publishServerComment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the server ownership decision", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, handled: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(publishServerComment(input)).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      "https://app.covallaby.com/api/v1/github/pr-comment",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("falls back for servers without the capability", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("missing", { status: 404 })));
    await expect(publishServerComment(input)).resolves.toBe(false);
  });
});
