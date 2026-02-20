const REPO_URL_PATTERNS = [
  /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i,
  /^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i,
  /^([\w.-]+)\/([\w.-]+)$/,
];

export interface ParsedRepo {
  owner: string;
  repo: string;
  slug: string;
}

export function parseGitHubRepoUrl(input: string): ParsedRepo {
  const normalizedInput = input.trim();

  for (const pattern of REPO_URL_PATTERNS) {
    const match = normalizedInput.match(pattern);
    if (!match) {
      continue;
    }

    const owner = match[1]?.trim();
    const repo = match[2]?.trim();

    if (!owner || !repo) {
      break;
    }

    return {
      owner,
      repo,
      slug: `${owner}/${repo}`,
    };
  }

  throw new Error(`Invalid GitHub repository URL: ${input}`);
}
