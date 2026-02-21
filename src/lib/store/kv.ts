import { Redis } from "@upstash/redis";
import { z } from "zod";

import {
  SubsystemListSchema,
  WikiPageSchema,
} from "@/lib/ai/schemas";
import type { AnalyzeCacheRecord } from "@/lib/store/types";

const redis = Redis.fromEnv();

const CACHE_KEY_PREFIX = "analyze:record:";
const REPO_LATEST_PREFIX = "analyze:repo-latest:";
const RECENT_REPOS_ZSET_KEY = "analyze:recent-repos";

const AnalyzeCacheResultSchema = z.object({
  productSummary: SubsystemListSchema.shape.productSummary,
  subsystems: SubsystemListSchema.shape.subsystems,
  wikiPages: z.array(WikiPageSchema),
});

function toSafeSegment(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

function buildRepoKey(owner: string, repo: string): string {
  return `${toSafeSegment(owner)}::${toSafeSegment(repo)}`;
}

function toCacheRecordSchema() {
  return z.object({
    cacheKey: z.string(),
    owner: z.string(),
    repo: z.string(),
    headSha: z.string(),
    createdAt: z.string(),
    result: AnalyzeCacheResultSchema,
  });
}

function parseRecord(value: unknown): AnalyzeCacheRecord | null {
  const parsed = toCacheRecordSchema().safeParse(value);
  if (!parsed.success) return null;
  return parsed.data;
}

export function isAnalyzeKvEnabled(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export async function readAnalyzeCacheFromKv(cacheKey: string): Promise<AnalyzeCacheRecord | null> {
  const raw = await redis.get(`${CACHE_KEY_PREFIX}${cacheKey}`);
  return parseRecord(raw);
}

export async function writeAnalyzeCacheToKv(record: AnalyzeCacheRecord): Promise<void> {
  await redis.set(`${CACHE_KEY_PREFIX}${record.cacheKey}`, record);

  const repoKey = buildRepoKey(record.owner, record.repo);
  await redis.set(`${REPO_LATEST_PREFIX}${repoKey}`, record.cacheKey);

  const createdAtScore = Date.parse(record.createdAt);
  await redis.zadd(RECENT_REPOS_ZSET_KEY, {
    member: repoKey,
    score: Number.isNaN(createdAtScore) ? Date.now() : createdAtScore,
  });
}

export async function readLatestAnalyzeCacheByRepoFromKv(params: {
  owner: string;
  repo: string;
}): Promise<AnalyzeCacheRecord | null> {
  const repoKey = buildRepoKey(params.owner, params.repo);
  const cacheKey = await redis.get<string>(`${REPO_LATEST_PREFIX}${repoKey}`);
  if (!cacheKey) return null;
  return readAnalyzeCacheFromKv(cacheKey);
}

export async function listLatestAnalyzeCachesFromKv(limit: number): Promise<AnalyzeCacheRecord[]> {
  if (limit <= 0) return [];

  const repoKeys = await redis.zrange<string[]>(RECENT_REPOS_ZSET_KEY, 0, limit - 1, {
    rev: true,
  });

  const cacheKeys = await Promise.all(
    repoKeys.map((repoKey) => redis.get<string>(`${REPO_LATEST_PREFIX}${repoKey}`)),
  );

  const records = await Promise.all(
    cacheKeys
      .filter((cacheKey): cacheKey is string => Boolean(cacheKey))
      .map((cacheKey) => readAnalyzeCacheFromKv(cacheKey)),
  );

  return records.filter((record): record is AnalyzeCacheRecord => record !== null);
}
