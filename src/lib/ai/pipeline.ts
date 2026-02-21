import { generateText, Output } from "ai";

import {
  buildEvidenceMappingPrompt,
  buildSignalPathSelectionPrompt,
  buildSubsystemExtractionPrompt,
  buildWikiDraftPrompt,
  FORBIDDEN_SUBSYSTEM_NAMES,
} from "@/lib/ai/prompts";
import { getOpenAIClient } from "@/lib/ai/client";
import {
  SignalPathSelectionSchema,
  SubsystemEvidenceSchema,
  SubsystemListSchema,
  WikiDraftSchema,
  WikiPageSchema,
  type SignalPathSelectionOutput,
  type SubsystemEvidenceOutput,
  type SubsystemListOutput,
  type WikiPageOutput,
} from "@/lib/ai/schemas";
import { buildNumberedContextWindow, countLines } from "@/lib/citations/line-numbering";
import { parseAndLinkCitations } from "@/lib/citations/parser";
import type { RepoFileContent } from "@/lib/github/client";
import type { Subsystem } from "@/lib/types";
import { AppError } from "@/lib/utils/errors";

const FORBIDDEN_NAME_SET = new Set(FORBIDDEN_SUBSYSTEM_NAMES.map((name) => name.toLowerCase()));
const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-5-mini";

const MAX_FILES_PER_SUBSYSTEM = 8;
const MAX_EVIDENCE_ITEMS_PER_SUBSYSTEM = 8;
const CONTEXT_MAX_LINES = 220;
const CONTEXT_HEAD_LINES = 150;
const CONTEXT_TAIL_LINES = 60;
const EVIDENCE_EXCERPT_MAX_LINES = 60;

export interface ScoredPath {
  path: string;
  score: number;
}

function hasInvalidSubsystemNames(output: SubsystemListOutput): boolean {
  return output.subsystems.some((subsystem) => FORBIDDEN_NAME_SET.has(subsystem.name.trim().toLowerCase()));
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3);
}

function buildSubsystemKeywords(subsystem: Subsystem): Set<string> {
  const raw = [
    subsystem.id,
    subsystem.name,
    subsystem.description,
    subsystem.userJourney,
    ...subsystem.relevantPaths,
    ...subsystem.entryPoints,
  ].join(" ");

  return new Set(tokenize(raw));
}

function extensionWeight(path: string): number {
  const extension = path.includes(".") ? path.split(".").pop()?.toLowerCase() : "";
  if (!extension) {
    return 0;
  }

  if (["ts", "tsx", "js", "jsx", "py", "go", "rs", "java", "kt", "rb", "php"].includes(extension)) {
    return 2;
  }

  if (["md", "mdx", "yaml", "yml", "json"].includes(extension)) {
    return 0.5;
  }

  return 1;
}

export function scoreSubsystemRelevantPaths(params: {
  subsystem: Subsystem;
  treePaths: string[];
  maxFiles?: number;
}): ScoredPath[] {
  const maxFiles = params.maxFiles ?? MAX_FILES_PER_SUBSYSTEM;
  const keywords = buildSubsystemKeywords(params.subsystem);
  const exactRelevant = new Set(params.subsystem.relevantPaths);
  const exactEntries = new Set(params.subsystem.entryPoints);

  const scored = params.treePaths
    .map((path) => {
      let score = 0;
      const normalized = path.toLowerCase();
      const pathTokens = tokenize(path);

      if (exactRelevant.has(path)) {
        score += 12;
      }
      if (exactEntries.has(path)) {
        score += 10;
      }

      for (const token of pathTokens) {
        if (keywords.has(token)) {
          score += 1.4;
        }
      }

      if (normalized.includes(params.subsystem.id.toLowerCase())) {
        score += 3;
      }
      if (normalized.includes(params.subsystem.name.toLowerCase().replace(/\s+/g, "-"))) {
        score += 2;
      }

      score += extensionWeight(path);
      return { path, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  return scored.slice(0, maxFiles);
}

function getLineCountByPath(files: RepoFileContent[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const file of files) {
    map.set(file.path, countLines(file.content));
  }
  return map;
}

function buildEvidenceExcerpt(file: RepoFileContent, startLine: number, endLine: number): string {
  const lines = file.content.split("\n");
  const validStart = Math.max(1, Math.min(startLine, lines.length));
  const validEnd = Math.max(validStart, Math.min(endLine, lines.length));
  const boundedEnd = Math.min(validEnd, validStart + EVIDENCE_EXCERPT_MAX_LINES - 1);

  const selected = lines.slice(validStart - 1, boundedEnd).map((line, index) => {
    const lineNo = validStart + index;
    return `${lineNo.toString().padStart(5, " ")} | ${line}`;
  });

  return selected.join("\n");
}

function fallbackEvidence(subsystem: Subsystem, files: RepoFileContent[]): SubsystemEvidenceOutput {
  const evidence = files.slice(0, Math.min(3, files.length)).map((file) => ({
    path: file.path,
    startLine: 1,
    endLine: Math.min(40, countLines(file.content)),
    score: 0.4,
    rationale: `Fallback evidence selected from ${file.path} for ${subsystem.name}.`,
  }));

  if (evidence.length === 0) {
    throw new AppError("No evidence files available for subsystem", {
      code: "EMPTY_EVIDENCE_CONTEXT",
      statusCode: 422,
      details: { subsystemId: subsystem.id },
    });
  }

  return SubsystemEvidenceSchema.parse({
    subsystemId: subsystem.id,
    subsystemName: subsystem.name,
    evidence,
  });
}

export async function extractSubsystems(params: {
  repoSlug: string;
  treePaths: string[];
  signalFiles: Array<{ path: string; content: string }>;
}): Promise<SubsystemListOutput> {
  const openai = getOpenAIClient();
  const prompt = buildSubsystemExtractionPrompt({
    repoSlug: params.repoSlug,
    treePaths: params.treePaths,
    signalFiles: params.signalFiles,
  });

  const result = await generateText({
    model: openai(OPENAI_MODEL),
    output: Output.object({ schema: SubsystemListSchema }),
    prompt,
    temperature: 0.2,
  });

  const parsed = result.output;
  if (hasInvalidSubsystemNames(parsed)) {
    throw new AppError("Model produced invalid subsystem names", {
      code: "INVALID_SUBSYSTEM_NAMES",
      statusCode: 422,
      details: { forbiddenNames: FORBIDDEN_SUBSYSTEM_NAMES },
    });
  }

  return parsed;
}

export async function selectSignalPathsWithAI(params: {
  repoSlug: string;
  treePaths: string[];
}): Promise<SignalPathSelectionOutput> {
  const openai = getOpenAIClient();

  if (params.treePaths.length === 0) {
    throw new AppError("Repository has no eligible files after filtering", {
      code: "EMPTY_FILE_TREE",
      statusCode: 422,
    });
  }

  const prompt = buildSignalPathSelectionPrompt({
    repoSlug: params.repoSlug,
    treePaths: params.treePaths,
  });

  const result = await generateText({
    model: openai(OPENAI_MODEL),
    output: Output.object({ schema: SignalPathSelectionSchema }),
    prompt,
    temperature: 0.1,
  });

  const available = new Set(params.treePaths);
  const deduped = [...new Set(result.output.paths)].filter((path) => available.has(path));

  if (deduped.length === 0) {
    throw new AppError("Model did not return usable signal paths", {
      code: "INVALID_SIGNAL_PATHS",
      statusCode: 422,
    });
  }

  return SignalPathSelectionSchema.parse({ paths: deduped });
}

export function selectEvidencePathsForSubsystems(params: {
  subsystems: Subsystem[];
  treePaths: string[];
  maxFilesPerSubsystem?: number;
}): Map<string, ScoredPath[]> {
  const selected = new Map<string, ScoredPath[]>();

  for (const subsystem of params.subsystems) {
    selected.set(
      subsystem.id,
      scoreSubsystemRelevantPaths({
        subsystem,
        treePaths: params.treePaths,
        maxFiles: params.maxFilesPerSubsystem,
      }),
    );
  }

  return selected;
}

export async function mapEvidenceForSubsystems(params: {
  repoSlug: string;
  subsystems: Subsystem[];
  files: RepoFileContent[];
  selectedPathsBySubsystem: Map<string, ScoredPath[]>;
}): Promise<SubsystemEvidenceOutput[]> {
  const openai = getOpenAIClient();
  const fileByPath = new Map(params.files.map((file) => [file.path, file] as const));
  const lineCounts = getLineCountByPath(params.files);

  return Promise.all(
    params.subsystems.map(async (subsystem) => {
      const selectedPaths = (params.selectedPathsBySubsystem.get(subsystem.id) ?? [])
        .map((entry) => entry.path)
        .filter((path) => fileByPath.has(path))
        .slice(0, MAX_FILES_PER_SUBSYSTEM);

      const files = selectedPaths
        .map((path) => fileByPath.get(path))
        .filter((file): file is RepoFileContent => Boolean(file));

      if (files.length === 0) {
        return fallbackEvidence(subsystem, params.files);
      }

      const fileContexts = files.map((file) => ({
        path: file.path,
        totalLines: lineCounts.get(file.path) ?? countLines(file.content),
        excerpt: buildNumberedContextWindow({
          content: file.content,
          maxLines: CONTEXT_MAX_LINES,
          headLines: CONTEXT_HEAD_LINES,
          tailLines: CONTEXT_TAIL_LINES,
        }),
      }));

      const prompt = buildEvidenceMappingPrompt({
        repoSlug: params.repoSlug,
        subsystem,
        fileContexts,
      });

      const result = await generateText({
        model: openai(OPENAI_MODEL),
        output: Output.object({ schema: SubsystemEvidenceSchema }),
        prompt,
        temperature: 0.1,
      });

      const validated = result.output.evidence
        .filter((item) => selectedPaths.includes(item.path))
        .filter((item) => {
          const maxLines = lineCounts.get(item.path);
          return Boolean(maxLines && item.startLine > 0 && item.endLine >= item.startLine && item.endLine <= maxLines);
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_EVIDENCE_ITEMS_PER_SUBSYSTEM);

      if (validated.length === 0) {
        return fallbackEvidence(subsystem, files);
      }

      return SubsystemEvidenceSchema.parse({
        subsystemId: subsystem.id,
        subsystemName: subsystem.name,
        evidence: validated,
      });
    }),
  );
}

export async function draftWikiPages(params: {
  repoSlug: string;
  owner: string;
  repo: string;
  sha: string;
  subsystems: Subsystem[];
  evidenceBySubsystem: SubsystemEvidenceOutput[];
  files: RepoFileContent[];
}): Promise<WikiPageOutput[]> {
  const openai = getOpenAIClient();
  const evidenceMap = new Map(params.evidenceBySubsystem.map((item) => [item.subsystemId, item] as const));
  const fileByPath = new Map(params.files.map((file) => [file.path, file] as const));
  const lineCountsByPath = getLineCountByPath(params.files);

  return Promise.all(
    params.subsystems.map(async (subsystem) => {
      const evidence = evidenceMap.get(subsystem.id);
      if (!evidence) {
        throw new AppError("Missing evidence for subsystem", {
          code: "MISSING_SUBSYSTEM_EVIDENCE",
          statusCode: 500,
          details: { subsystemId: subsystem.id },
        });
      }

      const evidenceWithExcerpts = evidence.evidence
        .map((item) => {
          const file = fileByPath.get(item.path);
          if (!file) {
            return null;
          }

          return {
            path: item.path,
            startLine: item.startLine,
            endLine: item.endLine,
            rationale: item.rationale,
            excerpt: buildEvidenceExcerpt(file, item.startLine, item.endLine),
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      const prompt = buildWikiDraftPrompt({
        repoSlug: params.repoSlug,
        subsystem,
        evidence: evidenceWithExcerpts,
      });

      const result = await generateText({
        model: openai(OPENAI_MODEL),
        output: Output.object({ schema: WikiDraftSchema }),
        prompt,
        temperature: 0.2,
      });

      const parsedCitations = parseAndLinkCitations({
        markdown: result.output.markdown,
        owner: params.owner,
        repo: params.repo,
        sha: params.sha,
        lineCountsByPath,
      });

      if (parsedCitations.citations.length === 0) {
        throw new AppError("Generated wiki page has no valid citations", {
          code: "MISSING_WIKI_CITATIONS",
          statusCode: 422,
          details: { subsystemId: subsystem.id },
        });
      }

      return WikiPageSchema.parse({
        subsystemId: subsystem.id,
        subsystemName: subsystem.name,
        markdown: parsedCitations.markdown,
        citations: parsedCitations.citations,
      });
    }),
  );
}
