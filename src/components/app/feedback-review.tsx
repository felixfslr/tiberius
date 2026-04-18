"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  applyFeedbackAction,
  dismissFeedbackAction,
  retryFeedbackAction,
} from "@/app/(dashboard)/agents/[id]/feedback/actions";
import type { FeedbackAnalysis, FeedbackStatus } from "@/lib/schemas/feedback";
import type { FeedbackRow } from "@/lib/services/feedback";
import { cn } from "@/lib/utils";

type FilterKey =
  | "all"
  | "pending"
  | "analyzed"
  | "applied"
  | "dismissed"
  | "failed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "analyzed", label: "Awaiting review" },
  { key: "applied", label: "Applied" },
  { key: "dismissed", label: "Dismissed" },
  { key: "failed", label: "Failed" },
];

export function FeedbackReview({
  agentId,
  agentName,
  initialRows,
  initialStatus,
}: {
  agentId: string;
  agentName: string;
  initialRows: FeedbackRow[];
  initialStatus: FeedbackStatus | "all";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(initialRows);
  const currentFilter = (searchParams?.get("status") ?? "all") as FilterKey;

  // Keep server-rendered rows in sync if the filter tab changes via the URL.
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  // Realtime: merge INSERT/UPDATE events into local rows.
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel(`feedback:${agentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feedback",
          filter: `agent_id=eq.${agentId}`,
        },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === "INSERT") {
              const next = [payload.new as FeedbackRow, ...prev];
              return dedupe(next);
            }
            if (payload.eventType === "UPDATE") {
              const updated = payload.new as FeedbackRow;
              return prev.map((r) => (r.id === updated.id ? updated : r));
            }
            if (payload.eventType === "DELETE") {
              const deleted = payload.old as { id?: string };
              return prev.filter((r) => r.id !== deleted.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [agentId]);

  const filtered = useMemo(() => {
    if (currentFilter === "all") return rows;
    return rows.filter((r) => r.status === currentFilter);
  }, [rows, currentFilter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) map[r.status] = (map[r.status] ?? 0) + 1;
    return map;
  }, [rows]);

  function setFilter(key: FilterKey) {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    if (key === "all") sp.delete("status");
    else sp.set("status", key);
    router.push(`/agents/${agentId}/feedback?${sp.toString()}`);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Feedback</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Teach {agentName} from the drafts you disagree with. The agent
            analyzes each note and proposes a knowledge edit for your review.
          </p>
        </div>
        <Link
          href={`/agents/${agentId}/playground`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Give feedback <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition",
              currentFilter === f.key
                ? "border-primary/60 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {f.label}
            {f.key !== "all" && counts[f.key] ? (
              <span className="ml-1.5 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                {counts[f.key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState agentId={agentId} filter={currentFilter} />
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((row) => (
            <FeedbackCard key={row.id} row={row} agentId={agentId} />
          ))}
        </div>
      )}
    </div>
  );
}

function dedupe(rows: FeedbackRow[]): FeedbackRow[] {
  const seen = new Set<string>();
  const out: FeedbackRow[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

function EmptyState({
  agentId,
  filter,
}: {
  agentId: string;
  filter: FilterKey;
}) {
  const msg =
    filter === "analyzed"
      ? "Nothing waiting for review."
      : filter === "applied"
        ? "No feedback has been applied yet."
        : filter === "failed"
          ? "No failures."
          : filter === "dismissed"
            ? "Nothing dismissed."
            : filter === "pending"
              ? "Nothing queued."
              : "No feedback yet — give the agent feedback from the playground to shape its knowledge base.";
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
      <p className="text-sm text-muted-foreground">{msg}</p>
      {filter === "all" ? (
        <Link
          href={`/agents/${agentId}/playground`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Open playground <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

function FeedbackCard({ row, agentId }: { row: FeedbackRow; agentId: string }) {
  const [pending, startTransition] = useTransition();
  const lastActionRef = useRef<string | null>(null);

  function run(
    action: () => Promise<{ ok: boolean; message?: string }>,
    label: string,
  ) {
    lastActionRef.current = label;
    startTransition(async () => {
      const res = await action();
      if (!res.ok) toast.error(res.message ?? `${label} failed`);
      else toast.success(`${label} ok`);
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-5 py-2.5">
        <div className="flex items-center gap-3">
          <StatusBadge status={row.status} />
          <span className="font-mono text-[11px] text-muted-foreground">
            {new Date(row.created_at).toLocaleString()}
          </span>
        </div>
        {row.applied_chunk_id ? (
          <Link
            href={`/agents/${agentId}/knowledge/graph?highlight=${row.applied_chunk_id}`}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Show in graph →
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2">
        <div className="space-y-3">
          <Section label="Operator's feedback">
            <p className="text-sm whitespace-pre-wrap">{row.feedback_text}</p>
          </Section>
          {row.trigger_message ? (
            <Section label="Trigger message">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {row.trigger_message}
              </p>
            </Section>
          ) : null}
          {row.draft_reply ? (
            <Section label="Agent's draft">
              <div className="rounded border border-border/60 bg-card p-2.5 text-xs whitespace-pre-wrap">
                {row.draft_reply}
              </div>
            </Section>
          ) : null}
        </div>

        <div className="space-y-3">
          {row.suggested_action ? (
            <AnalysisPanel analysis={row.suggested_action} />
          ) : row.status === "pending" || row.status === "analyzing" ? (
            <div className="flex items-center gap-2 rounded border border-dashed border-border p-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing with the knowledge base…
            </div>
          ) : row.status === "failed" ? (
            <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <div className="font-medium">Analysis failed</div>
                <div className="mt-1 text-destructive/80">
                  {row.error ?? "Unknown error"}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 bg-muted/20 px-5 py-2.5">
        {row.status === "analyzed" && row.suggested_action ? (
          <>
            <Button
              size="sm"
              onClick={() =>
                run(() => applyFeedbackAction(agentId, row.id), "Apply")
              }
              disabled={pending}
            >
              {pending && lastActionRef.current === "Apply" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-3.5 w-3.5" />
              )}
              Apply
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                run(() => dismissFeedbackAction(agentId, row.id), "Dismiss")
              }
              disabled={pending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Dismiss
            </Button>
          </>
        ) : null}
        {row.status === "failed" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              run(() => retryFeedbackAction(agentId, row.id), "Retry")
            }
            disabled={pending}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        ) : null}
        {row.status === "applied" && row.applied_chunk_id ? (
          <div className="font-mono text-[11px] text-muted-foreground">
            chunk{" "}
            <span className="text-foreground/80">
              {row.applied_chunk_id.slice(0, 8)}
            </span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function AnalysisPanel({ analysis }: { analysis: FeedbackAnalysis }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3" /> Analysis
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          conf {analysis.confidence.toFixed(2)}
        </span>
      </div>
      <div className="rounded border border-border/60 bg-card p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <ActionBadge action={analysis.action_type} />
          {analysis.likely_chunk_id ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              chunk {analysis.likely_chunk_id.slice(0, 8)}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-foreground/85">{analysis.issue_summary}</p>
      </div>

      {analysis.action_type === "edit_chunk" && analysis.edit_proposal ? (
        <DiffView proposal={analysis.edit_proposal} />
      ) : null}
      {analysis.action_type === "add_chunk" && analysis.edit_proposal ? (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/5 p-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            New chunk
          </div>
          <p className="text-xs whitespace-pre-wrap text-foreground/85">
            {analysis.edit_proposal.new_content}
          </p>
        </div>
      ) : null}
      {analysis.action_type === "deprecate_chunk" ? (
        <div className="rounded border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          This chunk will be marked deprecated and excluded from retrieval.
        </div>
      ) : null}
    </div>
  );
}

function DiffView({
  proposal,
}: {
  proposal: {
    old_content_snippet: string;
    new_content: string;
    reasoning: string;
  };
}) {
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
            <Undo2 className="h-3 w-3" /> Old
          </div>
          <p className="font-mono text-[11px] whitespace-pre-wrap text-destructive/90">
            {proposal.old_content_snippet || "(not captured)"}
          </p>
        </div>
        <div className="rounded border border-emerald-500/40 bg-emerald-500/5 p-2.5">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Wand2 className="h-3 w-3" /> New
          </div>
          <p className="font-mono text-[11px] whitespace-pre-wrap text-foreground/85">
            {proposal.new_content}
          </p>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Why: {proposal.reasoning}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const map: Record<
    FeedbackStatus,
    { label: string; className: string; icon: React.ReactNode }
  > = {
    pending: {
      label: "pending",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      icon: <Clock className="h-3 w-3" />,
    },
    analyzing: {
      label: "analyzing",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    analyzed: {
      label: "awaiting review",
      className: "bg-primary/10 text-primary",
      icon: <Sparkles className="h-3 w-3" />,
    },
    applying: {
      label: "applying",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    applied: {
      label: "applied",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      icon: <Check className="h-3 w-3" />,
    },
    dismissed: {
      label: "dismissed",
      className: "bg-muted text-muted-foreground",
      icon: <X className="h-3 w-3" />,
    },
    failed: {
      label: "failed",
      className: "bg-destructive/10 text-destructive",
      icon: <TriangleAlert className="h-3 w-3" />,
    },
  };
  const entry = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold",
        entry.className,
      )}
    >
      {entry.icon}
      {entry.label}
    </span>
  );
}

function ActionBadge({ action }: { action: FeedbackAnalysis["action_type"] }) {
  const map: Record<FeedbackAnalysis["action_type"], string> = {
    edit_chunk: "edit",
    add_chunk: "add",
    deprecate_chunk: "deprecate",
    no_action: "no action",
  };
  return (
    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground/80">
      {map[action]}
    </span>
  );
}
