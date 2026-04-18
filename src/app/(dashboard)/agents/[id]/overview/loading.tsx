import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonAgentSubpage,
  SkeletonSectionLabel,
  SkeletonStatCards,
} from "@/components/app/skeletons";

export default function Loading() {
  return (
    <SkeletonAgentSubpage>
      <Skeleton className="h-4 w-80" />

      <SkeletonStatCards />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonSectionLabel />
          <Skeleton className="h-3 w-20" />
        </div>
        <Card className="divide-y divide-border overflow-hidden p-0 shadow-sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-5 py-3"
            >
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="space-y-2 p-5 shadow-sm">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-56" />
          </Card>
        ))}
      </section>
    </SkeletonAgentSubpage>
  );
}
