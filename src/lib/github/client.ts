import { Octokit } from "octokit";

import { buildGitHubPermalink } from "@/lib/citations/permalink";
import { shouldIncludePath } from "@/lib/github/filters";
import { AppError, isRetryableError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const MAX_FILE_BYTES = 150_000;
const DEFAULT_MAX_RETRIES = 3;

export interface RepoIdentity {
  owner: string;
  repo: string;
}

export interface RepoHead {
  defaultBranch: string;
  headSha: string;
}

export interface RepoFile {
  path: string;
  size: number;
}

export interface RepoFileContent {
  path: string;
  content: string;
  size: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGitHubClient(token = process.env.GITHUB_TOKEN) {
  return new Octokit(token ? { auth: token } : undefined);
}

export async function getRepoHead(
  octokit: Octokit,
  identity: RepoIdentity,
): Promise<RepoHead> {
  const repoResponse = await octokit.rest.repos.get({
    owner: identity.owner,
    repo: identity.repo,
  });

  const defaultBranch = repoResponse.data.default_branch;

  const branchResponse = await octokit.rest.repos.getBranch({
    owner: identity.owner,
    repo: identity.repo,
    branch: defaultBranch,
  });

  return {
    defaultBranch,
    headSha: branchResponse.data.commit.sha,
  };
}

export async function getRepoFileTree(
  octokit: Octokit,
  identity: RepoIdentity,
  sha: string,
): Promise<RepoFile[]> {
  const treeResponse = await octokit.rest.git.getTree({
    owner: identity.owner,
    repo: identity.repo,
    tree_sha: sha,
    recursive: "true",
  });

  return treeResponse.data.tree
    .filter((entry) => entry.type === "blob" && typeof entry.path === "string")
    .map((entry) => ({
      path: entry.path,
      size: entry.size ?? 0,
    }))
    .filter((file) => shouldIncludePath(file.path));
}

async function fetchSingleFile(
  octokit: Octokit,
  identity: RepoIdentity,
  params: { path: string; ref: string },
): Promise<RepoFileContent | null> {
  const response = await octokit.rest.repos.getContent({
    owner: identity.owner,
    repo: identity.repo,
    path: params.path,
    ref: params.ref,
  });

  if (Array.isArray(response.data) || response.data.type !== "file") {
    return null;
  }

  const encoded = response.data.content;
  const size = response.data.size ?? 0;

  if (!encoded || size > MAX_FILE_BYTES) {
    return null;
  }

  const content = Buffer.from(encoded, "base64").toString("utf8");

  return {
    path: params.path,
    content,
    size,
  };
}

export async function getSelectedFileContents(
  octokit: Octokit,
  identity: RepoIdentity,
  params: {
    ref: string;
    paths: string[];
    maxRetries?: number;
  },
): Promise<RepoFileContent[]> {
  const maxRetries = params.maxRetries ?? DEFAULT_MAX_RETRIES;
  const uniquePaths = [...new Set(params.paths)].filter(shouldIncludePath);
  const collected: RepoFileContent[] = [];

  for (const path of uniquePaths) {
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const file = await fetchSingleFile(octokit, identity, { path, ref: params.ref });
        if (file) {
          collected.push(file);
        }
        break;
      } catch (error) {
        attempt += 1;

        if (attempt > maxRetries || !isRetryableError(error)) {
          logger.error("Failed to fetch file content", {
            owner: identity.owner,
            repo: identity.repo,
            path,
            attempts: attempt,
            error,
          });
          throw new AppError("Failed to fetch repository content", {
            code: "GITHUB_FETCH_FAILED",
            statusCode: 502,
            details: { path },
          });
        }

        const backoffMs = 300 * 2 ** (attempt - 1);
        await sleep(backoffMs);
      }
    }
  }

  return collected;
}

export function buildCitationPermalink(
  identity: RepoIdentity,
  params: {
    sha: string;
    path: string;
    startLine: number;
    endLine?: number;
  },
): string {
  return buildGitHubPermalink({
    owner: identity.owner,
    repo: identity.repo,
    sha: params.sha,
    path: params.path,
    startLine: params.startLine,
    endLine: params.endLine,
  });
}
