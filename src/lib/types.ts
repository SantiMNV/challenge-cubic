export type ProjectStatus = "pending" | "analyzing" | "ready" | "error";

export interface Project {
  id: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  headSha: string;
  status: ProjectStatus;
  productSummary?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subsystem {
  id: string;
  name: string;
  description: string;
  userJourney: string;
  relevantPaths: string[];
  entryPoints: string[];
  externalServices: string[];
}

export interface Citation {
  path: string;
  startLine: number;
  endLine: number;
  url: string;
}

export interface WikiPage {
  id: string;
  projectId: string;
  subsystemId: string;
  subsystemName: string;
  markdown: string;
  citations: Citation[];
  createdAt: string;
  updatedAt: string;
}

export interface SubsystemList {
  productSummary: string;
  subsystems: Subsystem[];
}
