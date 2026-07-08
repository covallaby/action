import { describe, expect, it } from "vitest";
import { badgeColor, renderBadge } from "./badge.js";

describe("renderBadge", () => {
  it("renders a self-contained SVG", () => {
    const svg = renderBadge(91.4);
    expect(svg).toMatchSnapshot();
    expect(svg).toContain("91.4%");
    expect(svg).not.toContain("href"); // self-contained: no external resources
  });

  it("handles missing coverage gracefully", () => {
    expect(renderBadge(null)).toContain("—");
    expect(badgeColor(null)).toBe("#9f9f9f");
  });

  it("colors by coverage level", () => {
    expect(badgeColor(95)).toBe("#2da44e");
    expect(badgeColor(80)).toBe("#a3b330");
    expect(badgeColor(65)).toBe("#d29922");
    expect(badgeColor(20)).toBe("#cf222e");
  });
});

describe("renderBadge security", () => {
  it("escapes an untrusted label so it can't inject SVG markup", () => {
    const svg = renderBadge(80, "</text></svg><script>alert(1)</script>");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
  it("caps label length", () => {
    expect(renderBadge(80, "x".repeat(500))).toContain("x".repeat(64));
  });
});
