import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonCardsGrid,
  SkeletonHeader,
  SkeletonPageShell,
} from "@/components/app/skeletons";

export default function Loading() {
  return (
    <SkeletonPageShell>
      <div className="flex items-start justify-between gap-4">
        <SkeletonHeader width="w-32" subWidth="w-96" />
        <Skeleton className="h-9 w-28" />
      </div>
      <SkeletonCardsGrid count={6} />
    </SkeletonPageShell>
  );
}
