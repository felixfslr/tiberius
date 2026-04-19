import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonAgentSubpage,
  SkeletonTable,
} from "@/components/app/skeletons";

export default function Loading() {
  return (
    <SkeletonAgentSubpage>
      <Skeleton className="h-4 w-96" />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
        <SkeletonTable cols={7} rows={4} />
      </section>

      <Card className="overflow-hidden p-0 shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-6 w-6" />
        </div>
        <div className="space-y-2 px-4 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </Card>
    </SkeletonAgentSubpage>
  );
}
