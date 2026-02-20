import { createOpenAI } from "@ai-sdk/openai";

import { AppError } from "@/lib/utils/errors";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new AppError("OPENAI_API_KEY is missing", {
      code: "MISSING_OPENAI_API_KEY",
      statusCode: 500,
    });
  }

  return createOpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1/",
  });
}
