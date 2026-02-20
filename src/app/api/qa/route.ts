import { streamText } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getOpenAIClient } from "@/lib/ai/client";
import { AppError } from "@/lib/utils/errors";
import { logger } from "@/lib/utils/logger";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-5-mini";

const QaMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1),
});

const QaContextSchema = z
  .object({
    repo: z.string().trim().optional(),
    headSha: z.string().trim().optional(),
    productSummary: z.string().trim().optional(),
    subsystems: z
      .array(
        z.object({
          name: z.string(),
          description: z.string(),
        }),
      )
      .optional(),
    wikiPages: z
      .array(
        z.object({
          subsystemName: z.string(),
          markdown: z.string(),
        }),
      )
      .optional(),
  })
  .optional();

const QaRequestSchema = z.object({
  messages: z.array(QaMessageSchema).min(1),
  context: QaContextSchema,
});

function buildSystemPrompt(context: z.infer<typeof QaContextSchema>) {
  if (!context) {
    return [
      "You are a concise engineering assistant.",
      "Answer using the conversation history only.",
      "If information is missing, say what is missing and ask a direct follow-up question.",
    ].join("\n");
  }

  const subsystemLines = (context.subsystems ?? [])
    .slice(0, 12)
    .map((subsystem) => `- ${subsystem.name}: ${subsystem.description}`)
    .join("\n");

  const pageContext = (context.wikiPages ?? [])
    .map((page) => `## ${page.subsystemName}\n${page.markdown}`)
    .join("\n\n")
    .slice(0, 22000);

  return [
    "You are a concise repository Q&A assistant.",
    "Use the provided wiki context to answer accurately.",
    "If the answer is uncertain, clearly say so and mention what data is missing.",
    "",
    `Repository: ${context.repo ?? "unknown"}`,
    `Head SHA: ${context.headSha ?? "unknown"}`,
    "",
    "Product Summary:",
    context.productSummary ?? "Not available.",
    "",
    "Subsystems:",
    subsystemLines || "Not available.",
    "",
    "Wiki Context:",
    pageContext || "Not available.",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = QaRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          code: "INVALID_REQUEST",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const payload = parsed.data;
    const openai = getOpenAIClient();
    const model =
      typeof openai.chat === "function"
        ? openai.chat(OPENAI_MODEL as never)
        : openai(OPENAI_MODEL);

    const result = streamText({
      model,
      temperature: 0.2,
      system: buildSystemPrompt(payload.context),
      messages: payload.messages.slice(-30).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (streamError) {
          logger.error("QA stream error", { error: streamError });
          controller.enqueue(encoder.encode("I hit a streaming error. Please retry."));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
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

    logger.error("Unexpected /api/qa error", { error });
    return NextResponse.json(
      {
        error: "Unexpected server error",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
