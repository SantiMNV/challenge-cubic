"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ChatAssistant } from "@/components/chat-assistant";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { AnalyzeResult } from "@/lib/analyze/types";
import { cn } from "@/lib/utils";

interface RepoWikiViewProps {
  result: AnalyzeResult;
}

export function RepoWikiView({ result }: RepoWikiViewProps) {
  const [query, setQuery] = useState("");
  const [selectedSubsystemId, setSelectedSubsystemId] = useState<string | null>(null);

  useEffect(() => {
    if (!result.subsystems.length) return;

    setSelectedSubsystemId((current) => {
      if (!current || !result.subsystems.some((subsystem) => subsystem.id === current)) {
        return result.subsystems[0]?.id ?? null;
      }
      return current;
    });
  }, [result]);

  const filteredSubsystems = useMemo(() => {
    if (!query.trim()) return result.subsystems;

    const needle = query.trim().toLowerCase();
    return result.subsystems.filter((subsystem) => {
      return subsystem.name.toLowerCase().includes(needle) || subsystem.description.toLowerCase().includes(needle);
    });
  }, [query, result]);

  const selectedPage = useMemo(() => {
    if (!selectedSubsystemId) return null;
    return result.wikiPages.find((page) => page.subsystemId === selectedSubsystemId) ?? null;
  }, [result, selectedSubsystemId]);

  const chatContext = useMemo(() => {
    return {
      repo: result.repo,
      headSha: result.headSha,
      productSummary: result.productSummary,
      subsystems: result.subsystems.map((subsystem) => ({
        name: subsystem.name,
        description: subsystem.description,
      })),
      wikiPages: result.wikiPages.map((page) => ({
        subsystemName: page.subsystemName,
        markdown: page.markdown,
      })),
    };
  }, [result]);

  return (
    <>
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
            <CardTitle className="font-serif text-2xl">{selectedPage?.subsystemName ?? "Select a subsystem"}</CardTitle>
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

      <ChatAssistant context={chatContext} />
    </>
  );
}
