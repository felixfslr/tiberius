import { Skeleton } from "@/components/ui/skeleton";

export default function GraphLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <Skeleton className="h-96 w-96 rounded-full opacity-40" />
      </div>
    </div>
  );
}
