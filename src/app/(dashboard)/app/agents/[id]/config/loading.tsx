import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonAgentSubpage } from "@/components/app/skeletons";

export default function Loading() {
  return (
    <SkeletonAgentSubpage>
      <Skeleton className="h-4 w-80" />

      <Card className="space-y-5 p-6 shadow-sm">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-28" />
      </Card>
    </SkeletonAgentSubpage>
  );
}
