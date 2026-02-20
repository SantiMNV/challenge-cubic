import { Octokit } from "octokit";

import { buildGitHubPermalink } from "@/lib/citations/permalink";
import { shouldIncludePath } from "@/lib/github/filters";
import { AppError, isRetryableError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const MAX_FILE_BYTES = 150_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_FETCH_CONCURRENCY = 8;

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
    concurrency?: number;
  },
): Promise<RepoFileContent[]> {
  const maxRetries = params.maxRetries ?? DEFAULT_MAX_RETRIES;
  const concurrency = Math.max(1, Math.min(params.concurrency ?? DEFAULT_FETCH_CONCURRENCY, 20));
  const uniquePaths = [...new Set(params.paths)].filter(shouldIncludePath);
  const collected: Array<RepoFileContent | null> = new Array(uniquePaths.length).fill(null);

  async function fetchPathWithRetry(path: string): Promise<RepoFileContent | null> {
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await fetchSingleFile(octokit, identity, { path, ref: params.ref });
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

    return null;
  }

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, uniquePaths.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= uniquePaths.length) {
        break;
      }

      collected[index] = await fetchPathWithRetry(uniquePaths[index]);
    }
  });

  await Promise.all(workers);
  return collected.filter((file): file is RepoFileContent => Boolean(file));
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
