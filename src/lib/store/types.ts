import type { SubsystemListOutput, WikiPageOutput } from "@/lib/ai/schemas";

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

function toSafeSegment(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

export function buildAnalyzeCacheKey(params: { owner: string; repo: string; headSha: string }): string {
  return `${toSafeSegment(params.owner)}__${toSafeSegment(params.repo)}__${toSafeSegment(params.headSha)}`;
}
