interface SubsystemPromptInput {
  repoSlug: string;
  treePaths: string[];
  signalFiles: Array<{ path: string; content: string }>;
}

interface SignalPathSelectionPromptInput {
  repoSlug: string;
  treePaths: string[];
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
