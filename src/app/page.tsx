import { RepoAnalyzer } from "@/components/repo-analyzer";

export default function Home() {
  return (
    <main className="w-full px-4 py-8 md:px-8 md:py-12">
      <section className="mb-8 space-y-3">
        <p className="text-primary text-xs font-semibold uppercase tracking-[0.2em]">Cubic Wiki Generator</p>
        <h1 className="font-serif text-4xl tracking-tight text-slate-900 md:text-5xl">Repository Intelligence, Rendered as a Wiki</h1>
        <p className="text-muted-foreground max-w-2xl text-base">
          Generate product-oriented subsystem docs from any public GitHub repository, with strict line-level citation links.
        </p>
      </section>

      <RepoAnalyzer />
    </main>
  );
}
