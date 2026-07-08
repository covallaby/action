import type { ChangedFile, CoverageReport } from "@covallaby/core";

/** The payload the CLI injects into the template. */
export interface ReportPayload {
  generatedAt: string;
  version: string;
  report: CoverageReport;
  /** path -> source text; best effort, files may be absent. */
  sources: Record<string, string>;
  /** Present when the CLI was given --diff. */
  patch?: ChangedFile[];
}

/** Demo data so `vite dev` (placeholder still in the template) shows a real UI. */
const demo: ReportPayload = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  version: "dev",
  report: {
    files: [
      {
        path: "src/payment.ts",
        lines: [
          { line: 2, hits: 12 },
          { line: 3, hits: 12 },
          { line: 4, hits: 0 },
          { line: 5, hits: 0 },
          { line: 8, hits: 12 },
          { line: 9, hits: 3 },
          { line: 12, hits: 0 },
        ],
        functions: [
          { name: "charge", line: 2, hits: 12 },
          { name: "refund", line: 8, hits: 3 },
        ],
        branches: [{ line: 3, taken: 1, total: 2 }],
      },
      {
        path: "src/checkout.ts",
        lines: [
          { line: 1, hits: 4 },
          { line: 2, hits: 4 },
          { line: 3, hits: 4 },
        ],
        functions: [{ name: "checkout", line: 1, hits: 4 }],
        branches: [],
      },
      {
        path: "src/util.ts",
        lines: [
          { line: 1, hits: 40 },
          { line: 2, hits: 0 },
        ],
        functions: [],
        branches: [],
      },
    ],
  },
  sources: {
    "src/payment.ts": `import { api } from "./api";\nexport function charge(cents: number) {\n  if (cents <= 0) {\n    throw new Error("amount must be positive");\n  }\n  return api.post("/charge", { cents });\n}\nexport function refund(id: string) {\n  return api.post("/refund", { id });\n}\n\nexport const RETRIES = compute();\n`,
    "src/checkout.ts": `import { charge } from "./payment";\nexport function checkout(cart: { total: number }) {\n  return charge(cart.total);\n}\n`,
  },
  patch: [
    { path: "src/payment.ts", added: false, lines: [4, 5, 8, 9] },
    { path: "src/checkout.ts", added: true, lines: [1, 2, 3] },
  ],
};

export function loadPayload(): ReportPayload {
  const el = document.getElementById("covallaby-data");
  if (el?.textContent) {
    try {
      return JSON.parse(el.textContent) as ReportPayload;
    } catch {
      // placeholder not replaced -> dev mode
    }
  }
  return demo;
}
