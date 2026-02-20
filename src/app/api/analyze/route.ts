import { z } from "zod";
import { NextResponse } from "next/server";

import { extractSubsystems, selectSignalPathsWithAI } from "@/lib/ai/pipeline";
import {
  createGitHubClient,
  getRepoFileTree,
  getRepoHead,
  getSelectedFileContents,
} from "@/lib/github/client";
import { cleanTreePaths } from "@/lib/github/filters";
import {
  buildAnalyzeCacheKey,
  readAnalyzeCache,
  writeAnalyzeCache,
} from "@/lib/store/memory";
import { AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";
import { parseGitHubRepoUrl } from "@/lib/utils/repo-url";

const AnalyzeRequestSchema = z.object({
  repoUrl: z.string().trim().min(1),
  forceRefresh: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();
    const requestParse = AnalyzeRequestSchema.safeParse(requestBody);

    if (!requestParse.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          code: "INVALID_REQUEST",
          details: requestParse.error.flatten(),
        },
        { status: 400 },
      );
    }

    const payload = requestParse.data;

    let parsedRepo: { owner: string; repo: string; slug: string };
    try {
      parsedRepo = parseGitHubRepoUrl(payload.repoUrl);
    } catch {
      throw new AppError("Invalid GitHub repository URL", {
        code: "INVALID_REPO_URL",
        statusCode: 400,
      });
    }

    const octokit = createGitHubClient();
    const repoHead = await getRepoHead(octokit, {
      owner: parsedRepo.owner,
      repo: parsedRepo.repo,
    });

    const cacheKey = buildAnalyzeCacheKey({
      owner: parsedRepo.owner,
      repo: parsedRepo.repo,
      headSha: repoHead.headSha,
    });

    if (!payload.forceRefresh) {
      const cached = await readAnalyzeCache(cacheKey);
      if (cached) {
        return NextResponse.json({
          status: "ready",
          source: "cache",
          cacheKey: cached.cacheKey,
          repo: `${cached.owner}/${cached.repo}`,
          headSha: cached.headSha,
          createdAt: cached.createdAt,
          subsystems: cached.result.subsystems,
          productSummary: cached.result.productSummary,
        });
      }
    }

    const repoFiles = await getRepoFileTree(
      octokit,
      { owner: parsedRepo.owner, repo: parsedRepo.repo },
      repoHead.headSha,
    );

    console.log("repoFiles", repoFiles);

    const treePaths = cleanTreePaths(repoFiles.map((file) => file.path));
    const signalSelection = await selectSignalPathsWithAI({
      repoSlug: parsedRepo.slug,
      treePaths,
    });
    const signalFiles = await getSelectedFileContents(
      octokit,
      { owner: parsedRepo.owner, repo: parsedRepo.repo },
      { ref: repoHead.headSha, paths: signalSelection.paths },
    );

    // console.log("signalFiles", signalFiles);
    console.log("signalPaths", signalSelection.paths);

    const extracted = await extractSubsystems({
      repoSlug: parsedRepo.slug,
      treePaths,
      signalFiles: signalFiles.map((file) => ({
        path: file.path,
        content: file.content,
      })),
    });

    const cacheRecord = {
      cacheKey,
      owner: parsedRepo.owner,
      repo: parsedRepo.repo,
      headSha: repoHead.headSha,
      createdAt: new Date().toISOString(),
      result: extracted,
    };
    await writeAnalyzeCache(cacheRecord);

    return NextResponse.json({
      status: "ready",
      source: "fresh",
      cacheKey,
      repo: parsedRepo.slug,
      defaultBranch: repoHead.defaultBranch,
      headSha: repoHead.headSha,
      createdAt: cacheRecord.createdAt,
      signalPaths: signalSelection.paths,
      subsystems: extracted.subsystems,
      productSummary: extracted.productSummary,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.statusCode },
      );
    }

    logger.error("Unexpected /api/analyze error", { error });
    return NextResponse.json(
      {
        error: "Unexpected server error",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
