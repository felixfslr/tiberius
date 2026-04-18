import { cn } from "@/lib/utils";

export type StatusVariant =
  | "live"
  | "draft"
  | "active"
  | "ready"
  | "failed"
  | "revoked"
  | "shared"
  | "above-threshold"
  | "below-threshold"
  | "pending"
  | "processing";

const CONFIG: Record<
  StatusVariant,
  { label: string; tone: "success" | "muted" | "danger" | "warning" }
> = {
  live: { label: "live", tone: "success" },
  draft: { label: "draft", tone: "muted" },
  active: { label: "active", tone: "success" },
  ready: { label: "ready", tone: "success" },
  failed: { label: "failed", tone: "danger" },
  revoked: { label: "revoked", tone: "danger" },
  shared: { label: "shared", tone: "success" },
  "above-threshold": { label: "above threshold", tone: "success" },
  "below-threshold": { label: "below threshold", tone: "danger" },
  pending: { label: "pending", tone: "muted" },
  processing: { label: "processing", tone: "warning" },
};

const TONE_CLASSES = {
  success:
    "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 [&>span.dot]:bg-emerald-500",
  muted: "bg-muted text-muted-foreground [&>span.dot]:bg-muted-foreground/60",
  danger: "bg-destructive/10 text-destructive [&>span.dot]:bg-destructive",
  warning:
    "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 [&>span.dot]:bg-amber-500",
} as const;

export function StatusPill({
  variant,
  label,
  className,
}: {
  variant: StatusVariant;
  label?: string;
  className?: string;
}) {
  const cfg = CONFIG[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONE_CLASSES[cfg.tone],
        className,
      )}
    >
      <span className="dot h-1.5 w-1.5 rounded-full" aria-hidden />
      {label ?? cfg.label}
    </span>
  );
}
