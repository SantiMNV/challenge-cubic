import { buildGitHubPermalink } from "@/lib/citations/permalink";
import type { Citation } from "@/lib/types";

const CITE_MARKER_REGEX = /\[\[cite:([^:\]]+):(\d+)-(\d+)\]\]/g;

interface ParseMarkdownCitationsInput {
  markdown: string;
  owner: string;
  repo: string;
  sha: string;
  lineCountsByPath: Map<string, number>;
}

export function parseAndLinkCitations(input: ParseMarkdownCitationsInput): {
  markdown: string;
  citations: Citation[];
} {
  const seen = new Set<string>();
  const citations: Citation[] = [];

  const linkedMarkdown = input.markdown.replace(
    CITE_MARKER_REGEX,
    (fullMatch, pathRaw: string, startRaw: string, endRaw: string) => {
      const path = pathRaw.trim();
      const startLine = Number.parseInt(startRaw, 10);
      const endLine = Number.parseInt(endRaw, 10);
      const maxLines = input.lineCountsByPath.get(path);

      if (!maxLines) {
        return "";
      }

      if (
        !Number.isInteger(startLine) ||
        !Number.isInteger(endLine) ||
        startLine <= 0 ||
        endLine < startLine ||
        endLine > maxLines
      ) {
        return "";
      }

      const url = buildGitHubPermalink({
        owner: input.owner,
        repo: input.repo,
        sha: input.sha,
        path,
        startLine,
        endLine,
      });

      const dedupeKey = `${path}:${startLine}:${endLine}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        citations.push({
          path,
          startLine,
          endLine,
          url,
        });
      }

      return `[${path}:${startLine}-${endLine}](${url})`;
    },
  );

  return {
    markdown: linkedMarkdown,
    citations,
  };
}
