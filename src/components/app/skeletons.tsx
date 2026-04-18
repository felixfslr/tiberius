import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Reusable block used in most page skeletons — header line + optional subline. */
export function SkeletonHeader({
  width = "w-48",
  sub = true,
  subWidth = "w-72",
}: {
  width?: string;
  sub?: boolean;
  subWidth?: string;
}) {
  return (
    <div className="space-y-2">
      <Skeleton className={cn("h-7", width)} />
      {sub ? <Skeleton className={cn("h-3.5", subWidth)} /> : null}
    </div>
  );
}

/** Label-only (UPPERCASE tracker label) */
export function SkeletonSectionLabel() {
  return <Skeleton className="h-3 w-28" />;
}

/** Generic table skeleton — matches Card > Table visual weight */
export function SkeletonTable({
  cols,
  rows = 5,
}: {
  cols: number;
  rows?: number;
}) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: cols }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-3 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <TableCell key={c}>
                  <Skeleton
                    className={cn(
                      "h-3.5",
                      c === 0 ? "w-40" : c === cols - 1 ? "w-12" : "w-20",
                    )}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function SkeletonCardsGrid({
  count = 6,
  cols = "md:grid-cols-2 xl:grid-cols-3",
}: {
  count?: number;
  cols?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", cols)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="space-y-4 p-5 shadow-sm">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-40" />
        </Card>
      ))}
    </div>
  );
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="space-y-3 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-3 w-28" />
        </Card>
      ))}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

export function SkeletonTopStrip() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-56 shrink-0 rounded-xl" />
      ))}
    </div>
  );
}

/** Full-page shell — applied inside the (dashboard) layout. */
export function SkeletonPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
      {children}
    </div>
  );
}

/** Agent sub-page shell — the agent shell (title + tabs) stays rendered from layout,
 * so this only covers the inner content area. */
export function SkeletonAgentSubpage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-8">
      {children}
    </div>
  );
}
