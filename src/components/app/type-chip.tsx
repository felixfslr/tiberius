import { cn } from "@/lib/utils";

export function TypeChip({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  return (
    <code
      className={cn(
        "inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground",
        className,
      )}
    >
      {type}
    </code>
  );
}
