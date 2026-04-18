import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[1fr_440px]">
      <div className="flex flex-col overflow-hidden border-r border-border">
        <div className="space-y-3 border-b border-border px-6 pt-6 pb-4">
          <Skeleton className="h-3.5 w-full max-w-xl" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-56 rounded-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-5 px-6 py-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            <Skeleton className="h-16 w-3/4 rounded-2xl" />
            <div className="flex justify-end">
              <Skeleton className="h-16 w-2/3 rounded-2xl" />
            </div>
            <Card className="space-y-3 p-4 shadow-sm">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            </Card>
          </div>
        </div>
        <div className="space-y-3 border-t border-border px-6 py-4">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>

      <aside className="hidden flex-col gap-5 overflow-y-auto bg-muted/30 p-5 xl:flex">
        <Card className="space-y-4 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-1 flex-1 rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-3 p-5 shadow-sm">
          <Skeleton className="h-3 w-28" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-lg border border-border p-3"
            >
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </Card>
      </aside>
    </div>
  );
}
