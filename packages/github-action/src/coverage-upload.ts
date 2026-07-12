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

/** Upload coverage shards as one hosted run, merging every file after the first. */
export async function uploadCoverageFiles(input: CoverageUploadInput): Promise<number> {
  let uploaded = 0;
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
    uploaded += 1;
  }
  return uploaded;
}
