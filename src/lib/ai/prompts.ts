interface SubsystemPromptInput {
  repoSlug: string;
  treePaths: string[];
  signalFiles: Array<{ path: string; content: string }>;
}

interface SignalPathSelectionPromptInput {
  repoSlug: string;
  treePaths: string[];
}

interface EvidenceMappingPromptInput {
  repoSlug: string;
  subsystem: {
    id: string;
    name: string;
    description: string;
    userJourney: string;
    relevantPaths: string[];
    entryPoints: string[];
  };
  fileContexts: Array<{ path: string; excerpt: string; totalLines: number }>;
}

interface WikiDraftPromptInput {
  repoSlug: string;
  subsystem: {
    id: string;
    name: string;
    description: string;
    userJourney: string;
    entryPoints: string[];
    externalServices: string[];
  };
  evidence: Array<{
    path: string;
    startLine: number;
    endLine: number;
    rationale: string;
    excerpt: string;
  }>;
}

export const FORBIDDEN_SUBSYSTEM_NAMES = [
  "frontend",
  "backend",
  "api",
  "utils",
  "shared",
  "database",
  "infrastructure",
];

export function buildSignalPathSelectionPrompt(input: SignalPathSelectionPromptInput): string {
  const pathList = input.treePaths.map((path) => `- ${path}`).join("\n");

  return [
    `Repository: ${input.repoSlug}`,
    "Select file paths that best explain product behavior and user-facing capabilities.",
    "Prioritize business/domain logic, feature entry points, and docs. Avoid low-signal config-only files.",
    "The repository can be any stack (including monorepos and systems code).",
    "Return only JSON using the schema.",
    "File tree:",
    pathList,
  ].join("\n\n");
}

export function buildSubsystemExtractionPrompt(input: SubsystemPromptInput): string {
  const pathList = input.treePaths.slice(0, 800).map((path) => `- ${path}`).join("\n");

  const fileSnippets = input.signalFiles
    .slice(0, 20)
    .map(({ path, content }) => {
      const snippet = content.split("\n").slice(0, 120).join("\n");
      return `### ${path}\n${snippet}`;
    })
    .join("\n\n");

  const signalSection =
    fileSnippets.length > 0
      ? fileSnippets
      : "No file snippets provided. Infer from the file tree and repository structure.";

  return [
    `Repository: ${input.repoSlug}`,
    "You are extracting product-facing subsystems from this codebase.",
    "Use user-facing feature areas, not technical layers.",
    `Forbidden names: ${FORBIDDEN_SUBSYSTEM_NAMES.join(", ")}`,
    "Return JSON that matches the provided schema exactly.",
    "Always include externalServices for each subsystem (use [] when there are none).",
    "Provide 3 to 8 subsystems.",
    "File tree:",
    pathList,
    "Signal files:",
    signalSection,
  ].join("\n\n");
}

export function buildEvidenceMappingPrompt(input: EvidenceMappingPromptInput): string {
  const fileBlock = input.fileContexts
    .map((file) =>
      [`### ${file.path} (totalLines: ${file.totalLines})`, file.excerpt].join("\n"),
    )
    .join("\n\n");

  return [
    `Repository: ${input.repoSlug}`,
    `Subsystem ID: ${input.subsystem.id}`,
    `Subsystem Name: ${input.subsystem.name}`,
    `Description: ${input.subsystem.description}`,
    `User Journey: ${input.subsystem.userJourney}`,
    `Relevant Paths: ${input.subsystem.relevantPaths.join(", ") || "None provided"}`,
    `Entry Points: ${input.subsystem.entryPoints.join(", ") || "None provided"}`,
    "Task: select the strongest code evidence ranges for this subsystem.",
    "Return evidence as path + line ranges found in the provided files.",
    "Line numbers must match the numbered excerpts exactly.",
    "Use score in [0,1] where higher means stronger evidence.",
    "Return only JSON using the schema.",
    "Files:",
    fileBlock,
  ].join("\n\n");
}

export function buildWikiDraftPrompt(input: WikiDraftPromptInput): string {
  const evidenceBlock = input.evidence
    .map((item, index) =>
      [
        `Evidence ${index + 1}: ${item.path}:${item.startLine}-${item.endLine}`,
        `Rationale: ${item.rationale}`,
        item.excerpt,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    `Repository: ${input.repoSlug}`,
    `Subsystem ID: ${input.subsystem.id}`,
    `Subsystem Name: ${input.subsystem.name}`,
    `Description: ${input.subsystem.description}`,
    `User Journey: ${input.subsystem.userJourney}`,
    `Entry Points: ${input.subsystem.entryPoints.join(", ") || "None provided"}`,
    `External Services: ${input.subsystem.externalServices.join(", ") || "None"}`,
    "Write markdown with these required sections (exact headings):",
    "## Overview",
    "## How It Works",
    "## User Flow",
    "## Entry Points",
    "## Data Models",
    "## External Dependencies",
    "## Gotchas",
    "For technical claims, include citation markers exactly as [[cite:path:start-end]].",
    "Only use paths and line ranges from provided evidence.",
    "Do not output a citations array; only markdown.",
    "Evidence:",
    evidenceBlock,
  ].join("\n\n");
}
