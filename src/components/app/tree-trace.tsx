"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type {
  CriticScores,
  EngagementDistribution,
  EngagementStage,
  JudgeDecision,
  TonePolishSource,
} from "@/lib/schemas/reply";

/* ──────────────────────────────────────────────────────────────────────── */
/* Streamed trace state — populated incrementally as SSE events arrive.    */
/* ──────────────────────────────────────────────────────────────────────── */

export type DraftBranch = {
  hypothesis: EngagementStage;
  probability: number;
  status: "pending" | "drafting" | "done";
  reply_text?: string;
  latency_ms?: number;
  critics?: CriticScores;
};

export type TraceState = {
  retrievalDone: boolean;
  numChunks?: number;

  distribution?: EngagementDistribution;
  top3?: Array<{ stage: EngagementStage; probability: number }>;

  branches: [DraftBranch | null, DraftBranch | null, DraftBranch | null];

  judge?: JudgeDecision;
  chosenIndex?: 0 | 1 | 2;

  synthesisText?: string;

  tonePolish?: {
    sources: TonePolishSource[];
    before: string;
    after: string;
    skipped: boolean;
  };

  finalDone: boolean;
  errors: string[];
};

export const initialTrace = (): TraceState => ({
  retrievalDone: false,
  branches: [null, null, null],
  finalDone: false,
  errors: [],
});

/* ──────────────────────────────────────────────────────────────────────── */
/* Component                                                                */
/* ──────────────────────────────────────────────────────────────────────── */

export function TreeTrace({
  trace,
  active,
}: {
  trace: TraceState;
  active: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  // After the run finishes, default-collapse but keep togglable.
  const isOpen = active || expanded;

  return (
    <div className="rounded-xl border border-border bg-card/40 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          stage-conditional tree-of-drafts
          {active ? (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> live
            </span>
          ) : trace.finalDone ? (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> done
            </span>
          ) : null}
        </div>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {isOpen ? (
        <div className="space-y-3 border-t border-border/60 p-4">
          <StageRow trace={trace} />
          <DraftsRow trace={trace} />
          <JudgeRow trace={trace} />
          <PolishRow trace={trace} />
          {trace.errors.length > 0 ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
              {trace.errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ── individual rows ────────────────────────────────────────────────── */

function StageRow({ trace }: { trace: TraceState }) {
  const status: "pending" | "active" | "done" = trace.distribution
    ? "done"
    : trace.retrievalDone
      ? "active"
      : "pending";
  return (
    <Step
      status={status}
      label="Analyzing conversation stage"
      detail={
        trace.distribution ? (
          <DistributionBars
            distribution={trace.distribution}
            top3={trace.top3}
          />
        ) : (
          <span className="text-muted-foreground">classifying…</span>
        )
      }
    />
  );
}

function DraftsRow({ trace }: { trace: TraceState }) {
  const branches = trace.branches.filter((b): b is DraftBranch => !!b);
  const total = trace.top3?.length ?? branches.length;
  const doneCount = branches.filter((b) => b.status === "done").length;
  const status: "pending" | "active" | "done" = !trace.top3
    ? "pending"
    : doneCount < total
      ? "active"
      : "done";

  return (
    <Step
      status={status}
      label="Drafting alternatives"
      counter={trace.top3 ? `${doneCount} / ${total}` : undefined}
      detail={
        trace.top3 ? (
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => {
              const b = trace.branches[i];
              const top = trace.top3![i];
              if (!top) return null;
              return (
                <DraftBranchRow
                  key={i}
                  index={i as 0 | 1 | 2}
                  hypothesis={top.stage}
                  probability={top.probability}
                  branch={b}
                  isChosen={trace.chosenIndex === i}
                />
              );
            })}
          </div>
        ) : null
      }
    />
  );
}

function JudgeRow({ trace }: { trace: TraceState }) {
  const status: "pending" | "active" | "done" = trace.judge
    ? "done"
    : trace.branches.every((b) => b?.status === "done")
      ? "active"
      : "pending";
  return (
    <Step
      status={status}
      label="Selecting best approach"
      detail={
        trace.judge ? (
          <div className="space-y-1">
            <div className="font-mono text-[11px] text-foreground/85">
              →{" "}
              {trace.judge.chosen === "synthesis"
                ? "synthesis"
                : `Draft ${trace.judge.chosen}`}
              {typeof trace.chosenIndex === "number" &&
              trace.chosenIndex >= 0 &&
              trace.branches[trace.chosenIndex] ? (
                <span className="ml-1 text-muted-foreground">
                  ({trace.branches[trace.chosenIndex]!.hypothesis}-optimized)
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {trace.judge.reasoning}
            </div>
            {trace.judge.synthesis_plan ? (
              <div className="rounded border border-dashed border-border p-1.5 font-mono text-[10px] text-foreground/75">
                synthesis plan: {trace.judge.synthesis_plan}
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">judging…</span>
        )
      }
    />
  );
}

function PolishRow({ trace }: { trace: TraceState }) {
  const status: "pending" | "active" | "done" = trace.tonePolish
    ? "done"
    : trace.judge
      ? "active"
      : "pending";
  return (
    <Step
      status={status}
      label="Calibrating tone against historical patterns"
      detail={
        trace.tonePolish ? (
          trace.tonePolish.skipped ? (
            <span className="text-muted-foreground">
              no historical replies for this stage — skipped
            </span>
          ) : (
            <details className="group">
              <summary className="cursor-pointer text-[11px] text-muted-foreground">
                {trace.tonePolish.sources.length} reference reply
                {trace.tonePolish.sources.length === 1 ? "" : "s"} ·{" "}
                {
                  trace.tonePolish.sources.filter(
                    (s) => s.origin === "reply_logs",
                  ).length
                }{" "}
                from reply_logs ·{" "}
                {
                  trace.tonePolish.sources.filter(
                    (s) => s.origin === "tov_examples",
                  ).length
                }{" "}
                from tov · click to inspect
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {trace.tonePolish.sources.map((s, i) => (
                  <div
                    key={i}
                    className="rounded border border-border bg-muted/40 p-2 text-[11px]"
                  >
                    <div className="mb-1 font-mono text-[9px] text-muted-foreground">
                      [{s.origin}]
                    </div>
                    <div className="line-clamp-3 whitespace-pre-wrap">
                      {s.content}
                    </div>
                  </div>
                ))}
                <div className="rounded border border-border bg-card p-2 text-[11px]">
                  <div className="mb-1 font-mono text-[9px] text-muted-foreground">
                    before → after
                  </div>
                  <div className="line-through opacity-60">
                    {trace.tonePolish.before}
                  </div>
                  <div className="mt-1">{trace.tonePolish.after}</div>
                </div>
              </div>
            </details>
          )
        ) : (
          <span className="text-muted-foreground">retrieving Ferdi tone…</span>
        )
      }
    />
  );
}

/* ── primitives ─────────────────────────────────────────────────────── */

function Step({
  status,
  label,
  counter,
  detail,
}: {
  status: "pending" | "active" | "done";
  label: string;
  counter?: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-4 w-4 items-center justify-center">
        {status === "pending" ? (
          <CircleDot className="h-3 w-3 text-muted-foreground/50" />
        ) : status === "active" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : (
          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        )}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span
            className={cn(
              status === "pending" ? "text-muted-foreground/70" : undefined,
            )}
          >
            {label}
            {status === "active" ? "…" : ""}
          </span>
          {counter ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              [{counter}]
            </span>
          ) : null}
        </div>
        {detail ? <div className="text-[11px]">{detail}</div> : null}
      </div>
    </div>
  );
}

function DistributionBars({
  distribution,
  top3,
}: {
  distribution: EngagementDistribution;
  top3?: Array<{ stage: EngagementStage; probability: number }>;
}) {
  const stages: EngagementStage[] = [
    "engaged",
    "fit_mismatch",
    "qualifying",
    "scheduling",
    "ghosting",
  ];
  const topSet = new Set(top3?.map((t) => t.stage));
  return (
    <div className="space-y-1">
      {stages.map((s) => {
        const p = distribution[s];
        const inTop = topSet.has(s);
        return (
          <div
            key={s}
            className="flex items-center gap-2 font-mono text-[10px]"
          >
            <span
              className={cn(
                "w-24 shrink-0",
                inTop ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  inTop ? "bg-primary" : "bg-muted-foreground/40",
                )}
                style={{ width: `${Math.round(p * 100)}%` }}
              />
            </div>
            <span className="w-10 text-right tabular-nums">{p.toFixed(2)}</span>
          </div>
        );
      })}
      {distribution.reasoning ? (
        <div className="pt-1 text-[10px] text-muted-foreground italic">
          {distribution.reasoning}
        </div>
      ) : null}
    </div>
  );
}

function DraftBranchRow({
  index,
  hypothesis,
  probability,
  branch,
  isChosen,
}: {
  index: 0 | 1 | 2;
  hypothesis: EngagementStage;
  probability: number;
  branch: DraftBranch | null;
  isChosen: boolean;
}) {
  const status = branch?.status ?? "pending";
  const ordinal = ["①", "②", "③"][index] ?? `${index + 1}`;
  const preview = branch?.reply_text?.slice(0, 60) ?? "";

  // Tick animation: 0 / 6 segments while pending, 3 while drafting, 6 when done.
  const ticks = status === "done" ? 6 : status === "drafting" ? 3 : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1 font-mono text-[10px]",
        isChosen ? "bg-primary/10 ring-1 ring-primary/40" : null,
      )}
    >
      <span className="w-3 text-muted-foreground">{ordinal}</span>
      <span className="w-24 shrink-0 truncate">
        {hypothesis}
        <span className="text-muted-foreground"> {probability.toFixed(2)}</span>
      </span>
      <span className="flex w-12 shrink-0 gap-px">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-sm",
              i < ticks ? "bg-primary" : "bg-muted",
              status === "drafting" && i >= ticks ? "animate-pulse" : null,
            )}
          />
        ))}
      </span>
      <span className="w-14 shrink-0 text-muted-foreground">
        {status === "done"
          ? `${branch?.latency_ms}ms`
          : status === "drafting"
            ? "drafting…"
            : "queued"}
      </span>
      <span className="flex-1 truncate text-foreground/80">
        {preview ? `"${preview}…"` : ""}
      </span>
      {branch?.critics ? (
        <span className="ml-2 text-muted-foreground">
          c
          {(
            (branch.critics.stage_appropriateness +
              branch.critics.groundedness +
              branch.critics.tone_match +
              branch.critics.intent_match) /
            4
          ).toFixed(2)}
        </span>
      ) : null}
    </div>
  );
}
