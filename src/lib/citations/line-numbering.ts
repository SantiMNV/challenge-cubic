export interface NumberedFileContext {
  path: string;
  totalLines: number;
  excerpt: string;
}

function formatNumberedLine(lineNumber: number, line: string): string {
  return `${lineNumber.toString().padStart(5, " ")} | ${line}`;
}

export function countLines(content: string): number {
  return content.split("\n").length;
}

export function toNumberedContent(content: string): string {
  const lines = content.split("\n");
  return lines.map((line, index) => formatNumberedLine(index + 1, line)).join("\n");
}

export function buildNumberedContextWindow(params: {
  content: string;
  maxLines: number;
  headLines: number;
  tailLines: number;
}): string {
  const lines = params.content.split("\n");
  const total = lines.length;

  if (total <= params.maxLines) {
    return lines.map((line, index) => formatNumberedLine(index + 1, line)).join("\n");
  }

  const headEnd = Math.min(params.headLines, total);
  const tailStart = Math.max(total - params.tailLines + 1, headEnd + 1);

  const head = lines
    .slice(0, headEnd)
    .map((line, index) => formatNumberedLine(index + 1, line));

  const tail = lines
    .slice(tailStart - 1)
    .map((line, index) => formatNumberedLine(tailStart + index, line));

  return [
    ...head,
    `... (${tailStart - headEnd - 1} lines omitted) ...`,
    ...tail,
  ].join("\n");
}
