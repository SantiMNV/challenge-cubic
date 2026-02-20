import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  SubsystemListSchema,
  WikiPageSchema,
  type SubsystemListOutput,
  type WikiPageOutput,
} from "@/lib/ai/schemas";

const CACHE_DIR = path.join(process.cwd(), ".cache", "analyze");

export interface AnalyzeCacheRecord {
  cacheKey: string;
  owner: string;
  repo: string;
  headSha: string;
  createdAt: string;
  result: {
    productSummary: SubsystemListOutput["productSummary"];
    subsystems: SubsystemListOutput["subsystems"];
    wikiPages: WikiPageOutput[];
  };
}

const AnalyzeCacheResultSchema = z.object({
  productSummary: SubsystemListSchema.shape.productSummary,
  subsystems: SubsystemListSchema.shape.subsystems,
  wikiPages: z.array(WikiPageSchema),
});

function toSafeSegment(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

export function buildAnalyzeCacheKey(params: { owner: string; repo: string; headSha: string }): string {
  return `${toSafeSegment(params.owner)}__${toSafeSegment(params.repo)}__${toSafeSegment(params.headSha)}`;
}

function getCacheFilePath(cacheKey: string): string {
  return path.join(CACHE_DIR, `${cacheKey}.json`);
}

export async function readAnalyzeCache(cacheKey: string): Promise<AnalyzeCacheRecord | null> {
  try {
    const filePath = getCacheFilePath(cacheKey);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as AnalyzeCacheRecord;

    return {
      ...parsed,
      result: AnalyzeCacheResultSchema.parse(parsed.result),
    };
  } catch {
    return null;
  }
}

export async function writeAnalyzeCache(record: AnalyzeCacheRecord): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const filePath = getCacheFilePath(record.cacheKey);
  await writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
}

export async function readLatestAnalyzeCacheByRepo(params: {
  owner: string;
  repo: string;
}): Promise<AnalyzeCacheRecord | null> {
  const expectedOwner = toSafeSegment(params.owner);
  const expectedRepo = toSafeSegment(params.repo);

  let fileNames: string[];
  try {
    fileNames = await readdir(CACHE_DIR);
  } catch {
    return null;
  }

  const candidates = fileNames
    .filter((fileName) => fileName.endsWith(".json"))
    .filter((fileName) => {
      const [ownerSegment, repoSegment] = fileName.replace(/\.json$/i, "").split("__");
      return ownerSegment === expectedOwner && repoSegment === expectedRepo;
    });

  if (!candidates.length) {
    return null;
  }

  const parsedRecords = await Promise.all(
    candidates.map(async (fileName) => {
      try {
        const raw = await readFile(path.join(CACHE_DIR, fileName), "utf8");
        const parsed = JSON.parse(raw) as AnalyzeCacheRecord;
        return {
          ...parsed,
          result: AnalyzeCacheResultSchema.parse(parsed.result),
        };
      } catch {
        return null;
      }
    }),
  );

  const validRecords = parsedRecords.filter((record): record is AnalyzeCacheRecord => record !== null);
  if (!validRecords.length) {
    return null;
  }

  validRecords.sort((a, b) => {
    const first = Date.parse(a.createdAt);
    const second = Date.parse(b.createdAt);
    return second - first;
  });

  return validRecords[0] ?? null;
}

export async function listLatestAnalyzeCaches(limit: number): Promise<AnalyzeCacheRecord[]> {
  let fileNames: string[];
  try {
    fileNames = await readdir(CACHE_DIR);
  } catch {
    return [];
  }

  const parsedRecords = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith(".json"))
      .map(async (fileName) => {
        try {
          const raw = await readFile(path.join(CACHE_DIR, fileName), "utf8");
          const parsed = JSON.parse(raw) as AnalyzeCacheRecord;
          return {
            ...parsed,
            result: AnalyzeCacheResultSchema.parse(parsed.result),
          };
        } catch {
          return null;
        }
      }),
  );

  const validRecords = parsedRecords.filter((record): record is AnalyzeCacheRecord => record !== null);

  validRecords.sort((a, b) => {
    const first = Date.parse(a.createdAt);
    const second = Date.parse(b.createdAt);
    return second - first;
  });

  const uniqueByRepo = new Map<string, AnalyzeCacheRecord>();
  for (const record of validRecords) {
    const key = `${record.owner.toLowerCase()}::${record.repo.toLowerCase()}`;
    if (!uniqueByRepo.has(key)) {
      uniqueByRepo.set(key, record);
    }
  }

  return Array.from(uniqueByRepo.values()).slice(0, Math.max(0, limit));
}
