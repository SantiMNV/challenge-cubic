export function buildGitHubPermalink(params: {
  owner: string;
  repo: string;
  sha: string;
  path: string;
  startLine: number;
  endLine?: number;
}): string {
  const { owner, repo, sha, path, startLine, endLine } = params;
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const lineAnchor = endLine && endLine > startLine ? `#L${startLine}-L${endLine}` : `#L${startLine}`;

  return `https://github.com/${owner}/${repo}/blob/${sha}/${encodedPath}${lineAnchor}`;
}
