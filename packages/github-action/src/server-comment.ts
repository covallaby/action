export async function publishServerComment(input: {
  serverUrl: string;
  token: string;
  repo: string;
  pr: number;
  marker: string;
  body: string;
}): Promise<boolean> {
  const response = await fetch(`${input.serverUrl}/api/v1/github/pr-comment`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      repo: input.repo,
      pr: input.pr,
      marker: input.marker,
      body: input.body,
    }),
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Covallaby server PR comment → ${response.status}`);
  const result = (await response.json()) as { handled?: boolean };
  return result.handled === true;
}
