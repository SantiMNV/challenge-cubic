import {
  isAnalyzeKvEnabled,
  listLatestAnalyzeCachesFromKv,
  readAnalyzeCacheFromKv,
  readLatestAnalyzeCacheByRepoFromKv,
  writeAnalyzeCacheToKv,
} from "@/lib/store/kv";
import {
  buildAnalyzeCacheKey,
  type AnalyzeCacheRecord,
} from "@/lib/store/types";
import { AppError } from "@/lib/utils/errors";

export { buildAnalyzeCacheKey, type AnalyzeCacheRecord };

function assertUpstashConfigured() {
  if (!isAnalyzeKvEnabled()) {
    throw new AppError("Upstash Redis is not configured", {
      code: "UPSTASH_NOT_CONFIGURED",
      statusCode: 500,
      details: "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    });
  }
}

export async function readAnalyzeCache(
  cacheKey: string,
): Promise<AnalyzeCacheRecord | null> {
  assertUpstashConfigured();
  return readAnalyzeCacheFromKv(cacheKey);
}

export async function writeAnalyzeCache(
  record: AnalyzeCacheRecord,
): Promise<void> {
  assertUpstashConfigured();
  await writeAnalyzeCacheToKv(record);
}

export async function readLatestAnalyzeCacheByRepo(params: {
  owner: string;
  repo: string;
}): Promise<AnalyzeCacheRecord | null> {
  assertUpstashConfigured();
  return readLatestAnalyzeCacheByRepoFromKv(params);
}

export async function listLatestAnalyzeCaches(
  limit: number,
): Promise<AnalyzeCacheRecord[]> {
  assertUpstashConfigured();
  return listLatestAnalyzeCachesFromKv(limit);
}
