import { Skeleton } from "@/components/ui/skeleton";

export default function FeedbackLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
