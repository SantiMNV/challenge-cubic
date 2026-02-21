import { NextResponse } from "next/server";

import { listLatestAnalyzeCaches } from "@/lib/store";

const MAX_ITEMS = 3;

export async function GET() {
  const records = await listLatestAnalyzeCaches(MAX_ITEMS);

  return NextResponse.json({
    items: records.map((record) => ({
      owner: record.owner,
      repo: record.repo,
      headSha: record.headSha,
      createdAt: record.createdAt,
    })),
  });
}
