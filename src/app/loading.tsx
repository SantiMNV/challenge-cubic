import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="w-full px-4 py-8 md:px-8 md:py-12">
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Skeleton className="h-[60vh] w-full lg:sticky lg:top-4" />
        <Skeleton className="h-[60vh] w-full" />
      </div>
    </main>
  );
}
