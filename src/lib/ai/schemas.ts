import { z } from "zod";

export const SubsystemSchema = z.object({
  id: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(3),
  description: z.string().trim().min(10),
  userJourney: z.string().trim().min(20),
  relevantPaths: z.array(z.string().trim().min(1)).min(1),
  entryPoints: z.array(z.string().trim().min(1)).min(1).max(3),
  externalServices: z.array(z.string().trim()),
});

export const SubsystemListSchema = z.object({
  productSummary: z.string().trim().min(10),
  subsystems: z.array(SubsystemSchema).min(3).max(8),
});

export const SignalPathSelectionSchema = z.object({
  paths: z.array(z.string().trim().min(1)).min(1),
});

export const CitationSchema = z
  .object({
    path: z.string().trim().min(1),
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    url: z.string().url(),
  })
  .refine((citation) => citation.startLine <= citation.endLine, {
    message: "startLine must be less than or equal to endLine",
    path: ["startLine"],
  });

export const WikiPageSchema = z.object({
  subsystemId: z.string().trim().min(1),
  subsystemName: z.string().trim().min(1),
  markdown: z.string().min(100),
  citations: z.array(CitationSchema),
});

export type SubsystemListOutput = z.infer<typeof SubsystemListSchema>;
export type SignalPathSelectionOutput = z.infer<typeof SignalPathSelectionSchema>;
export type WikiPageOutput = z.infer<typeof WikiPageSchema>;
