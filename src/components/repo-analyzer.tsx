"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Citation {
  path: string;
  startLine: number;
  endLine: number;
  url: string;
}

interface WikiPage {
  subsystemId: string;
  subsystemName: string;
  markdown: string;
  citations: Citation[];
}

interface Subsystem {
  id: string;
  name: string;
  description: string;
}

interface AnalyzeResult {
  status: string;
  source: "cache" | "fresh";
  repo: string;
  headSha: string;
  productSummary: string;
  subsystems: Subsystem[];
  wikiPages: WikiPage[];
}

const stages = ["Fetching", "Analyzing", "Writing", "Ready"] as const;

type AnalyzeStage = (typeof stages)[number] | "Idle" | "Error";

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
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<AnalyzeStage>("Idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [selectedSubsystemId, setSelectedSubsystemId] = useState<string | null>(null);

  useEffect(() => {
    if (!result?.subsystems.length) return;

    setSelectedSubsystemId((current) => {
      if (!current || !result.subsystems.some((subsystem) => subsystem.id === current)) {
        return result.subsystems[0]?.id ?? null;
      }
      return current;
    });
  }, [result]);

  const isLoading = stage !== "Idle" && stage !== "Ready" && stage !== "Error";

  const filteredSubsystems = useMemo(() => {
    if (!result) return [];

    if (!query.trim()) return result.subsystems;

    const needle = query.trim().toLowerCase();
    return result.subsystems.filter((subsystem) => {
      return subsystem.name.toLowerCase().includes(needle) || subsystem.description.toLowerCase().includes(needle);
    });
  }, [query, result]);

  const selectedPage = useMemo(() => {
    if (!result || !selectedSubsystemId) return null;
    return result.wikiPages.find((page) => page.subsystemId === selectedSubsystemId) ?? null;
  }, [result, selectedSubsystemId]);

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
    setSelectedSubsystemId(null);

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

          <div className="grid gap-2 sm:grid-cols-4">
            {stages.map((item) => {
              const currentIndex = stages.indexOf(stage as (typeof stages)[number]);
              const itemIndex = stages.indexOf(item);
              const complete = currentIndex > -1 && itemIndex <= currentIndex;

              return (
                <div
                  key={item}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs font-medium",
                    complete ? "border-primary/50 bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  {item}
                </div>
              );
            })}
          </div>

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

      {result ? (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="p-0 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
            <CardHeader className="gap-3 px-4 pb-2 pt-4">
              <CardTitle className="font-serif text-lg">Subsystems</CardTitle>
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute left-2 top-2.5 size-4" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-8"
                  placeholder="Search subsystem"
                />
              </div>
            </CardHeader>
            <Separator />
            <ScrollArea className="p-3 lg:h-[calc(100vh-9rem)]">
              <div className="space-y-2">
                {filteredSubsystems.map((subsystem) => {
                  const isActive = subsystem.id === selectedSubsystemId;

                  return (
                    <button
                      type="button"
                      key={subsystem.id}
                      onClick={() => setSelectedSubsystemId(subsystem.id)}
                      className={cn(
                        "w-full rounded-md border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-primary bg-primary/10"
                          : "border-border/70 bg-background hover:border-primary/60 hover:bg-accent",
                      )}
                    >
                      <div className="line-clamp-1 text-sm font-semibold">{subsystem.name}</div>
                      <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">{subsystem.description}</div>
                    </button>
                  );
                })}
                {!filteredSubsystems.length ? (
                  <p className="text-muted-foreground text-sm">No subsystem matches your search.</p>
                ) : null}
              </div>
            </ScrollArea>
          </Card>

          <Card className="min-h-[70vh] p-0">
            <CardHeader className="gap-2 px-6 pt-6">
              <CardTitle className="font-serif text-2xl">
                {selectedPage?.subsystemName ?? "Select a subsystem"}
              </CardTitle>
              <CardDescription>{result.productSummary}</CardDescription>
            </CardHeader>
            <Separator />
            <div className="px-6 pb-6">
              {selectedPage ? (
                <div className="space-y-6 py-6">
                  <article className="max-w-none space-y-4 text-sm leading-7 text-slate-700">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="font-serif mt-2 text-3xl text-slate-900">{children}</h1>,
                        h2: ({ children }) => (
                          <h2 className="font-serif mt-8 border-b border-slate-200 pb-2 text-2xl text-slate-900">{children}</h2>
                        ),
                        h3: ({ children }) => <h3 className="font-serif mt-6 text-xl text-slate-900">{children}</h3>,
                        p: ({ children }) => <p className="text-sm leading-7 text-slate-700">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc space-y-1 pl-6">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6">{children}</ol>,
                        code: ({ children }) => (
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">{children}</code>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary inline-flex items-center gap-1 underline underline-offset-2"
                          >
                            {children}
                            <ExternalLink className="size-3" />
                          </a>
                        ),
                      }}
                    >
                      {selectedPage.markdown}
                    </ReactMarkdown>
                  </article>

                  <Separator />

                  <section className="space-y-3">
                    <h3 className="font-serif text-lg text-slate-900">Citations</h3>
                    {selectedPage.citations.length ? (
                      <div className="space-y-2">
                        {selectedPage.citations.map((citation) => (
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noreferrer"
                            key={`${citation.path}-${citation.startLine}-${citation.endLine}`}
                            className="group flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:border-slate-400"
                          >
                            <span className="line-clamp-1 text-slate-800">
                              {citation.path} (L{citation.startLine}-L{citation.endLine})
                            </span>
                            <ExternalLink className="size-3 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No citations were returned for this page.</p>
                    )}
                  </section>
                </div>
              ) : (
                <p className="text-muted-foreground py-6 text-sm">Select a subsystem to view generated documentation.</p>
              )}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
