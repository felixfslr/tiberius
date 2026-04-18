import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonAgentSubpage,
  SkeletonList,
  SkeletonSectionLabel,
  SkeletonTable,
  SkeletonTopStrip,
} from "@/components/app/skeletons";

export default function Loading() {
  return (
    <SkeletonAgentSubpage>
      <SkeletonTopStrip />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonSectionLabel />
          <Skeleton className="h-8 w-28" />
        </div>
        <SkeletonTable cols={4} rows={5} />
      </section>

      <section className="space-y-3">
        <SkeletonSectionLabel />
        <SkeletonList rows={4} />
      </section>
    </SkeletonAgentSubpage>
  );
}
