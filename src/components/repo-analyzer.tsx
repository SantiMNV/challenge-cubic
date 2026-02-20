"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { RepoWikiView } from "@/components/repo-wiki-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyzeResult } from "@/lib/analyze/types";

const stages = ["Fetching", "Analyzing", "Writing", "Ready"] as const;

type AnalyzeStage = (typeof stages)[number] | "Idle" | "Error";

interface RecentCachedItem {
  owner: string;
  repo: string;
  headSha: string;
  createdAt: string;
}

function isValidGitHubUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return parsed.hostname === "github.com" && segments.length >= 2;
  } catch {
    return false;
  }
}

function LoadingWikiShell() {
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="p-0 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
        <CardHeader className="gap-3 p-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <Separator />
        <CardContent className="p-4">
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-[60vh] p-0">
        <CardHeader className="gap-3 p-6">
          <Skeleton className="h-7 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </CardHeader>
        <Separator />
        <CardContent className="space-y-3 p-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
}

export function RepoAnalyzer() {
  const [repoUrl, setRepoUrl] = useState("");
  const [stage, setStage] = useState<AnalyzeStage>("Idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [latestCached, setLatestCached] = useState<RecentCachedItem[]>([]);

  const isLoading = stage !== "Idle" && stage !== "Ready" && stage !== "Error";

  useEffect(() => {
    async function loadRecentCaches() {
      try {
        const response = await fetch("/api/analyze/recent");
        if (!response.ok) return;

        const data = (await response.json()) as { items?: RecentCachedItem[] };
        setLatestCached(Array.isArray(data.items) ? data.items.slice(0, 3) : []);
      } catch {
        setLatestCached([]);
      }
    }

    void loadRecentCaches();
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValidGitHubUrl(repoUrl)) {
      setStage("Error");
      setError("Please enter a valid GitHub repository URL, for example https://github.com/vercel/next.js.");
      return;
    }

    setStage("Fetching");
    setResult(null);

    const timer = window.setInterval(() => {
      setStage((current) => {
        if (current === "Fetching") return "Analyzing";
        if (current === "Analyzing") return "Writing";
        return current;
      });
    }, 1400);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      const data = (await response.json()) as AnalyzeResult & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to analyze repository.");
      }

      setResult(data);
      setStage("Ready");
    } catch (err) {
      setStage("Error");
      setError(err instanceof Error ? err.message : "Unexpected error while analyzing repository.");
    } finally {
      window.clearInterval(timer);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 overflow-hidden bg-card/80 shadow-lg backdrop-blur">
        <CardHeader className="gap-3">
          <CardTitle className="font-serif text-2xl tracking-tight">Analyze a GitHub repository</CardTitle>
          <CardDescription>
            Enter a public GitHub URL to generate feature-based subsystem wiki pages with line-level citations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={repoUrl}
              onChange={(event) => setRepoUrl(event.target.value)}
              placeholder="https://github.com/owner/repo"
              aria-label="Repository URL"
            />
            <Button type="submit" disabled={isLoading} className="sm:min-w-36">
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              {isLoading ? "Analyzing" : "Run Analysis"}
            </Button>
          </form>

          {isLoading ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs font-medium">
                  {stage === "Fetching" && "Fetching repository"}
                  {stage === "Analyzing" && "Analyzing codebase"}
                  {stage === "Writing" && "Writing wiki"}
                </span>
                <span className="text-muted-foreground/80 text-xs">May take up to 2 minutes</span>
              </div>
              <div className="bg-muted/50 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${
                      stage === "Fetching" ? 33 : stage === "Analyzing" ? 66 : stage === "Writing" ? 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          {latestCached.length ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.14em]">Latest generations</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {latestCached.map((item) => (
                  <Link
                    key={`${item.owner}/${item.repo}`}
                    href={`/${item.owner}/${item.repo}`}
                    className="hover:border-primary/60 hover:bg-accent rounded-md border border-border/70 bg-background px-3 py-2 text-sm transition-colors"
                  >
                    <div className="font-semibold text-foreground">
                      {item.owner}/{item.repo}
                    </div>
                    <div className="text-muted-foreground mt-1 text-xs">SHA {item.headSha.slice(0, 10)}</div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="text-destructive flex items-start gap-2 rounded-md border border-red-300/60 bg-red-50 p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {result ? (
            <div className="text-muted-foreground text-sm">
              <span className="font-medium text-foreground">{result.repo}</span>
              <span className="mx-2">•</span>
              <span>{result.source === "cache" ? "Loaded from cache" : "Fresh analysis"}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isLoading ? <LoadingWikiShell /> : null}
      {result ? <RepoWikiView result={result} /> : null}
    </div>
  );
}
