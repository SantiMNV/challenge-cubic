import { NextResponse } from "next/server";

import { readLatestAnalyzeCacheByRepo } from "@/lib/store/memory";

interface RouteContext {
  params: Promise<{
    user: string;
    repository: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  const { user, repository } = await context.params;

  const cached = await readLatestAnalyzeCacheByRepo({
    owner: user,
    repo: repository,
  });

  if (!cached) {
    return NextResponse.json(
      {
        error: "No cached analysis found for this repository.",
        code: "CACHE_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    status: "ready",
    source: "cache",
    cacheKey: cached.cacheKey,
    repo: `${cached.owner}/${cached.repo}`,
    headSha: cached.headSha,
    createdAt: cached.createdAt,
    subsystems: cached.result.subsystems,
    productSummary: cached.result.productSummary,
    wikiPages: cached.result.wikiPages,
  });
}
