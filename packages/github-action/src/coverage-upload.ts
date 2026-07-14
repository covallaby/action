import { readFile } from "node:fs/promises";

export interface CoverageUploadInput {
  serverUrl: string;
  token: string;
  files: string[];
  repo: string;
  branch: string;
  commit: string;
  pr: number | null;
}

export interface CoverageUploadResult {
  uploaded: number;
  /** Absolute dashboard URL for the upload's report page, when the server sent one. */
  url: string | null;
}

/** Upload coverage shards as one hosted run, merging every file after the first. */
export async function uploadCoverageFiles(
  input: CoverageUploadInput,
): Promise<CoverageUploadResult> {
  let uploaded = 0;
  let reportUrl: string | null = null;
  for (const file of input.files) {
    const url = new URL("/api/v1/upload", `${input.serverUrl}/`);
    url.searchParams.set("repo", input.repo);
    url.searchParams.set("branch", input.branch);
    url.searchParams.set("commit", input.commit);
    if (input.pr !== null) url.searchParams.set("pr", String(input.pr));
    if (uploaded > 0) url.searchParams.set("merge", "1");

    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${input.token}` },
      body: await readFile(file),
    });
    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(
        `Hosted coverage upload failed for "${file}" (${response.status})${detail ? `: ${detail}` : "."}`,
      );
    }
    // Shards merge into one upload row, so every response points at the same page.
    try {
      const body = (await response.json()) as { url?: string };
      if (typeof body.url === "string") {
        reportUrl = new URL(body.url, `${input.serverUrl}/`).toString();
      }
    } catch {
      // An unparseable body only costs the deep link, never the upload.
    }
    uploaded += 1;
  }
  return { uploaded, url: reportUrl };
}
