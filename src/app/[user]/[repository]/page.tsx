import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { RepoWikiView } from "@/components/repo-wiki-view";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { readLatestAnalyzeCacheByRepo } from "@/lib/store/memory";
import { cn } from "@/lib/utils";

interface RouteParams {
  params: Promise<{
    user: string;
    repository: string;
  }>;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function RepositoryPage({ params }: RouteParams) {
  const { user, repository } = await params;
  const cached = await readLatestAnalyzeCacheByRepo({ owner: user, repo: repository });

  return (
    <main className="w-full space-y-6 px-4 py-8 md:px-8 md:py-12">
      <section className="space-y-3">
        {cached ? (
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "-ml-2 text-muted-foreground hover:text-foreground"
            )}
          >
            <ChevronLeft className="mr-1 size-4" />
            Go back
          </Link>
        ) : null}
        <p className="text-primary text-xs font-semibold uppercase tracking-[0.2em]">Cubic Wiki Generator</p>
        <h1 className="font-serif text-4xl tracking-tight text-slate-900 md:text-5xl">{user}/{repository}</h1>
        {cached ? (
          <p className="text-sm text-muted-foreground">
            Loaded from local cache ({formatTimestamp(cached.createdAt)}), SHA {cached.headSha.slice(0, 12)}.
          </p>
        ) : null}
      </section>

      {cached ? (
        <>
          <RepoWikiView
            result={{
              status: "ready",
              source: "cache",
              repo: `${cached.owner}/${cached.repo}`,
              headSha: cached.headSha,
              productSummary: cached.result.productSummary,
              subsystems: cached.result.subsystems,
              wikiPages: cached.result.wikiPages,
            }}
          />
        </>
      ) : (
        <Card className="border-border/70 overflow-hidden bg-card/80 shadow-lg backdrop-blur">
          <CardHeader className="gap-2">
            <CardTitle className="font-serif text-2xl tracking-tight">No cached project found</CardTitle>
            <CardDescription>
              Analyze https://github.com/{user}/{repository} from the home page to create wiki pages for this route.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className={cn(buttonVariants({ variant: "default" }))}>
              Go Home
            </Link>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
