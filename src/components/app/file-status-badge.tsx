import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  extracting: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  chunking: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  enriching: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  embedding: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  ready: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export function FileStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", STATUS_STYLE[status])}>
      {status}
    </Badge>
  );
}
