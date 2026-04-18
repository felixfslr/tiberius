import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown during transitions between agent sub-tabs. The agent header + tab-nav
 * come from the layout, so we only fill the inner content area here. Keep it
 * light so it doesn't flash heavy content.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
