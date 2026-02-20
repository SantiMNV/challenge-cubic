export interface Citation {
  path: string;
  startLine: number;
  endLine: number;
  url: string;
}

export interface WikiPage {
  subsystemId: string;
  subsystemName: string;
  markdown: string;
  citations: Citation[];
}

export interface Subsystem {
  id: string;
  name: string;
  description: string;
}

export interface AnalyzeResult {
  status: string;
  source: "cache" | "fresh";
  repo: string;
  headSha: string;
  productSummary: string;
  subsystems: Subsystem[];
  wikiPages: WikiPage[];
}
