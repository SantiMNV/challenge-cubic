import { generateObject } from "ai";

import {
  buildSignalPathSelectionPrompt,
  buildSubsystemExtractionPrompt,
  FORBIDDEN_SUBSYSTEM_NAMES,
} from "@/lib/ai/prompts";
import { getOpenAIClient } from "@/lib/ai/client";
import {
  SignalPathSelectionSchema,
  type SignalPathSelectionOutput,
  SubsystemListSchema,
  type SubsystemListOutput,
} from "@/lib/ai/schemas";
import { AppError } from "@/lib/utils/errors";

const FORBIDDEN_NAME_SET = new Set(
  FORBIDDEN_SUBSYSTEM_NAMES.map((name) => name.toLowerCase()),
);

const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-5-mini";

function hasInvalidSubsystemNames(output: SubsystemListOutput): boolean {
  return output.subsystems.some((subsystem) =>
    FORBIDDEN_NAME_SET.has(subsystem.name.trim().toLowerCase()),
  );
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

  const result = await generateObject({
    model: openai(OPENAI_MODEL),
    schema: SubsystemListSchema,
    prompt,
    temperature: 0.2,
  });

  const parsed = result.object;

  if (hasInvalidSubsystemNames(parsed)) {
    throw new AppError("Model produced invalid subsystem names", {
      code: "INVALID_SUBSYSTEM_NAMES",
      statusCode: 422,
      details: {
        forbiddenNames: FORBIDDEN_SUBSYSTEM_NAMES,
      },
    });
  }

  return parsed;
}

export async function selectSignalPathsWithAI(params: {
  repoSlug: string;
  treePaths: string[];
}): Promise<SignalPathSelectionOutput> {
  const openai = getOpenAIClient();
  const treePaths = params.treePaths;

  if (treePaths.length === 0) {
    throw new AppError("Repository has no eligible files after filtering", {
      code: "EMPTY_FILE_TREE",
      statusCode: 422,
    });
  }

  const prompt = buildSignalPathSelectionPrompt({
    repoSlug: params.repoSlug,
    treePaths,
  });

  const result = await generateObject({
    model: openai(OPENAI_MODEL),
    schema: SignalPathSelectionSchema,
    prompt,
    temperature: 0.1,
  });

  const parsed = result.object;
  const available = new Set(treePaths);
  const deduped = [...new Set(parsed.paths)].filter((path) =>
    available.has(path),
  );

  if (deduped.length === 0) {
    throw new AppError("Model did not return usable signal paths", {
      code: "INVALID_SIGNAL_PATHS",
      statusCode: 422,
    });
  }

  return SignalPathSelectionSchema.parse({ paths: deduped });
}
