import { summarize } from "@covallaby/core";
import { parseLcov } from "@covallaby/parsers";
import { describe, expect, it } from "vitest";
import { renderReport, reportJson } from "../src/render.js";

const lcov = `SF:src/payment.ts
FN:1,charge
FNDA:5,charge
DA:1,5
DA:2,5
DA:3,0
DA:4,0
DA:12,0
end_of_record
SF:src/checkout.ts
DA:1,2
DA:88,0
end_of_record
SF:src/util.ts
DA:1,10
end_of_record
`;

describe("renderReport", () => {
  it("renders the friendly human summary", () => {
    const report = parseLcov(lcov);
    expect(renderReport(report, summarize(report))).toMatchSnapshot();
  });

  it("celebrates full coverage", () => {
    const report = parseLcov("SF:src/a.ts\nDA:1,1\nend_of_record");
    expect(renderReport(report, summarize(report))).toContain("You're covered");
  });
});

describe("reportJson", () => {
  it("is a stable machine-readable shape", () => {
    const json = reportJson(summarize(parseLcov(lcov)));
    expect(json.lines).toEqual({ covered: 4, total: 8, percent: 50 });
    expect(json.totalFiles).toBe(3);
    expect(json.files.map((f) => f.path)).toEqual([
      "src/checkout.ts",
      "src/payment.ts",
      "src/util.ts",
    ]);
  });
});
