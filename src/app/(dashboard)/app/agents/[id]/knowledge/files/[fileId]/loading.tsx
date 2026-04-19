import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAgentSubpage } from "@/components/app/skeletons";

export default function Loading() {
  return (
    <SkeletonAgentSubpage>
      <div className="space-y-3">
        <Skeleton className="h-4 w-64" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-80" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-3.5 w-96" />
      </div>
      <Card className="space-y-3 p-5 shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-full" />
        ))}
      </Card>
    </SkeletonAgentSubpage>
  );
}
