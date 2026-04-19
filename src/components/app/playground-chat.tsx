"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Loader2,
  MessageCircle,
  MessageSquareWarning,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { StatusPill } from "./status-pill";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/schemas/agent";
import type {
  CriticScores,
  EngagementDistribution,
  EngagementStage,
  JudgeDecision,
  TonePolishSource,
  TreeTrace as TreeTraceData,
} from "@/lib/schemas/reply";
import {
  TreeTrace,
  initialTrace,
  type DraftBranch,
  type TraceState,
} from "./tree-trace";

type Message = {
  role: "user" | "assistant";
  content: string;
  ts?: string;
  meta?: Reply;
  trace?: TraceState;
};

type RetrievedChunk = {
  id: string;
  content: string;
  content_type: string;
  score: number;
  source: string;
};

type Reply = {
  reply_text: string;
  confidence: number;
  confidence_breakdown: {
    retrieval: number;
    intent: number;
    groundedness: number;
    consistency: number;
  };
  detected_stage: string;
  detected_intent: string;
  detected_intents: string[];
  suggested_tool: string;
  tool_args: Record<string, unknown>;
  reasoning: string;
  retrieved_chunk_ids: string[];
  reply_log_id: string;
  below_threshold: boolean;
  retrieved_chunks: RetrievedChunk[];
  prompt_preview: string;
  tree_trace?: TreeTraceData;
};

export function PlaygroundChat({ agent }: { agent: Agent }) {
  const [history, setHistory] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [historyDraft, setHistoryDraft] = useState("");
  const [rawJson, setRawJson] = useState("");
  const [mode, setMode] = useState<"trigger" | "history" | "raw">("trigger");
  const [streaming, setStreaming] = useState(false);
  const [liveTrace, setLiveTrace] = useState<TraceState | null>(null);
  const [lastReply, setLastReply] = useState<Reply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const traceRef = useRef<TraceState | null>(null);

  function applyEvent(event: { type: string; data: unknown }) {
    setLiveTrace((prev) => {
      const next: TraceState = prev ? { ...prev } : initialTrace();
      switch (event.type) {
        case "retrieval_done": {
          const d = event.data as { num_chunks: number };
          next.retrievalDone = true;
          next.numChunks = d.num_chunks;
          break;
        }
        case "stage_distribution": {
          const d = event.data as {
            distribution: EngagementDistribution;
            top3: Array<{ stage: EngagementStage; probability: number }>;
          };
          next.distribution = d.distribution;
          next.top3 = d.top3;
          // Pre-seed branches so the UI shows three pending rows immediately.
          next.branches = [0, 1, 2].map((i) => {
            const t = d.top3[i];
            if (!t) return null;
            const b: DraftBranch = {
              hypothesis: t.stage,
              probability: t.probability,
              status: "pending",
            };
            return b;
          }) as TraceState["branches"];
          break;
        }
        case "draft_started": {
          const d = event.data as {
            index: 0 | 1 | 2;
            hypothesis: EngagementStage;
            probability: number;
          };
          const updated = [...next.branches] as TraceState["branches"];
          updated[d.index] = {
            hypothesis: d.hypothesis,
            probability: d.probability,
            status: "drafting",
          };
          next.branches = updated;
          break;
        }
        case "draft_completed": {
          const d = event.data as {
            index: 0 | 1 | 2;
            hypothesis: EngagementStage;
            reply_text: string;
            latency_ms: number;
          };
          const updated = [...next.branches] as TraceState["branches"];
          const existing = updated[d.index];
          updated[d.index] = {
            hypothesis: d.hypothesis,
            probability: existing?.probability ?? 0,
            status: "done",
            reply_text: d.reply_text,
            latency_ms: d.latency_ms,
            critics: existing?.critics,
          };
          next.branches = updated;
          break;
        }
        case "critics_completed": {
          const d = event.data as { index: 0 | 1 | 2; scores: CriticScores };
          const updated = [...next.branches] as TraceState["branches"];
          const existing = updated[d.index];
          if (existing) {
            updated[d.index] = { ...existing, critics: d.scores };
          }
          next.branches = updated;
          break;
        }
        case "judge_decision": {
          const d = event.data as JudgeDecision;
          next.judge = d;
          if (d.chosen === 0 || d.chosen === 1 || d.chosen === 2) {
            next.chosenIndex = d.chosen;
          }
          break;
        }
        case "synthesis_completed": {
          const d = event.data as { reply_text: string };
          next.synthesisText = d.reply_text;
          break;
        }
        case "tone_polish_done": {
          const d = event.data as {
            sources: TonePolishSource[];
            before: string;
            after: string;
            skipped: boolean;
          };
          next.tonePolish = d;
          break;
        }
        case "final_reply": {
          next.finalDone = true;
          break;
        }
        case "error": {
          const d = event.data as { message: string; phase: string };
          next.errors = [...next.errors, `[${d.phase}] ${d.message}`];
          break;
        }
      }
      traceRef.current = next;
      return next;
    });
  }

  async function runReply(
    body: Record<string, unknown>,
    optimisticUser?: string,
  ) {
    setError(null);
    setStreaming(true);
    setLiveTrace(initialTrace());
    traceRef.current = initialTrace();

    let finalReply: Reply | null = null;

    try {
      const res = await fetch(`/api/v1/agents/${agent.id}/reply?stream=1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) {
        const fallback = await safeJson(res);
        setError(fallback?.error?.message ?? `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const event = parseSseFrame(frame);
          if (!event) continue;
          if (event.type === "final_reply") {
            finalReply = event.data as Reply;
          }
          applyEvent(event);
        }
      }

      if (finalReply) {
        setLastReply(finalReply);
        const completedTrace = traceRef.current;
        setHistory((prev) => {
          const next: Message[] = [...prev];
          if (
            optimisticUser &&
            !(
              next.length > 0 &&
              next[next.length - 1]!.role === "user" &&
              next[next.length - 1]!.content === optimisticUser
            )
          ) {
            next.push({
              role: "user",
              content: optimisticUser,
              ts: new Date().toISOString(),
            });
          }
          next.push({
            role: "assistant",
            content: finalReply!.reply_text,
            ts: new Date().toISOString(),
            meta: finalReply!,
            trace: completedTrace ?? undefined,
          });
          return next;
        });
        requestAnimationFrame(() =>
          chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        );
      } else {
        setError("Stream ended without a final reply");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "stream failed");
    } finally {
      setStreaming(false);
    }
  }

  function onGenerate() {
    if (mode === "trigger") {
      const trigger = input.trim();
      if (!trigger) return;
      setInput("");
      setHistory((prev) => [
        ...prev,
        { role: "user", content: trigger, ts: new Date().toISOString() },
      ]);
      runReply(
        {
          trigger_message: trigger,
          history: history.map((m) => ({ role: m.role, content: m.content })),
        },
        trigger,
      );
    } else if (mode === "history") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(historyDraft);
      } catch {
        toast.error("History must be JSON array of {role, content}");
        return;
      }
      if (!Array.isArray(parsed)) {
        toast.error("History must be a JSON array");
        return;
      }
      const last = parsed[parsed.length - 1] as
        | {
            role?: string;
            content?: string;
          }
        | undefined;
      if (!last || last.role !== "user" || !last.content) {
        toast.error("Last message must be role:user with content");
        return;
      }
      runReply({
        trigger_message: last.content,
        history: parsed.slice(0, -1),
      });
    } else {
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        toast.error("Invalid JSON body");
        return;
      }
      runReply(parsed);
    }
  }

  function onRegenerate() {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setHistory((prev) => prev.filter((m) => m !== prev[prev.length - 1]));
    runReply({
      trigger_message: lastUser.content,
      history: history
        .slice(0, history.lastIndexOf(lastUser))
        .map((m) => ({ role: m.role, content: m.content })),
    });
  }

  function reset() {
    setHistory([]);
    setLastReply(null);
    setError(null);
    setInput("");
  }

  async function copyThread() {
    const text = history
      .map((m) => `${m.role === "user" ? "user" : "assistant"}: ${m.content}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("Thread copied");
  }

  return (
    <div className="grid flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[1fr_440px]">
      {/* Chat column */}
      <div className="flex flex-col overflow-hidden border-r border-border">
        <div className="flex flex-col gap-3 border-b border-border px-6 pt-6 pb-4">
          <p className="text-sm text-muted-foreground">
            Paste a trigger message — or edit the conversation history — to
            generate a draft reply. The right panel shows retrieved chunks,
            confidence breakdown, and the tool the model picked.
          </p>
          <div className="flex items-center justify-between gap-3">
            <ChannelBadge agent={agent} />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyThread}
                disabled={history.length === 0}
              >
                <Copy className="mr-2 h-3.5 w-3.5" /> Copy thread
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                disabled={history.length === 0}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-5">
            {history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No messages yet. Paste a prospect message below to see a draft.
              </div>
            ) : null}
            {history.map((m, i) => (
              <div key={i} className="flex flex-col gap-3">
                <MessageBubble message={m} agent={agent} />
                {m.role === "assistant" && m.trace ? (
                  <TreeTrace trace={m.trace} active={false} />
                ) : null}
              </div>
            ))}
            {streaming && liveTrace ? (
              <TreeTrace trace={liveTrace} active={true} />
            ) : null}
            {history.length > 0 &&
            history[history.length - 1]!.role === "assistant" &&
            history[history.length - 1]!.meta ? (
              <DraftCard
                agentId={agent.id}
                reply={history[history.length - 1]!.meta!}
                onRegenerate={onRegenerate}
                onCopy={async () => {
                  await navigator.clipboard.writeText(
                    history[history.length - 1]!.content,
                  );
                  toast.success("Draft copied");
                }}
              />
            ) : null}
            {streaming && !liveTrace ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> starting…
              </div>
            ) : null}
            {error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <div ref={chatBottomRef} />
          </div>
        </div>

        <div className="border-t border-border bg-background px-6 py-4">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as typeof mode)}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="trigger">Trigger message</TabsTrigger>
                  <TabsTrigger value="history">Edit history</TabsTrigger>
                  <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="trigger" className="flex items-end gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onGenerate();
                    }
                  }}
                  rows={2}
                  placeholder="Paste the prospect's incoming message…"
                  disabled={streaming}
                  className="flex-1 resize-none"
                />
                <Button
                  onClick={onGenerate}
                  disabled={streaming || !input.trim()}
                >
                  <Sparkles className="mr-2 h-4 w-4" /> Generate
                </Button>
              </TabsContent>
              <TabsContent value="history" className="flex flex-col gap-2">
                <Textarea
                  value={historyDraft}
                  onChange={(e) => setHistoryDraft(e.target.value)}
                  rows={8}
                  placeholder='[{"role":"user","content":"Hi..."},{"role":"assistant","content":"..."},{"role":"user","content":"Latest prospect message"}]'
                  className="font-mono text-xs"
                />
                <div className="flex justify-end">
                  <Button onClick={onGenerate} disabled={streaming}>
                    <Sparkles className="mr-2 h-4 w-4" /> Generate from history
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="raw" className="flex flex-col gap-2">
                <Textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  rows={8}
                  placeholder='{"trigger_message":"...","history":[]}'
                  className="font-mono text-xs"
                />
                <div className="flex justify-end">
                  <Button onClick={onGenerate} disabled={streaming}>
                    <Sparkles className="mr-2 h-4 w-4" /> Generate from JSON
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
            <div className="text-[11px] text-muted-foreground">
              Enter to generate · threshold: {agent.config.confidence_threshold}
            </div>
          </div>
        </div>
      </div>

      {/* Debug column */}
      <aside className="hidden flex-col gap-5 overflow-y-auto bg-muted/30 p-5 xl:flex">
        {lastReply ? (
          <>
            <ConfidencePanel
              reply={lastReply}
              threshold={agent.config.confidence_threshold}
            />
            <RetrievalTrace reply={lastReply} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Confidence + retrieval trace appear here after the first reply.
          </div>
        )}
      </aside>
    </div>
  );
}

function ChannelBadge({ agent }: { agent: Agent }) {
  const phone = "+49 172 · ••• · 4418";
  const recipient = agent.name;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
        <MessageCircle className="h-3 w-3" />
        whatsapp
      </span>
      <span className="font-mono text-muted-foreground">{phone}</span>
      <span className="text-muted-foreground">→ {recipient}</span>
    </div>
  );
}

function MessageBubble({ message, agent }: { message: Message; agent: Agent }) {
  const isUser = message.role === "user";
  const label = isUser ? "prospect" : agent.name;
  const time = message.ts
    ? new Date(message.ts).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-start" : "items-end",
      )}
    >
      <Card
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
          isUser ? "bg-card" : "bg-primary/10 text-foreground",
        )}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
      </Card>
      <div className="px-2 text-[11px] text-muted-foreground">
        {label}
        {time ? ` · ${time}` : ""}
      </div>
    </div>
  );
}

function DraftCard({
  agentId,
  reply,
  onCopy,
  onRegenerate,
}: {
  agentId: string;
  reply: Reply;
  onCopy: () => void;
  onRegenerate: () => void;
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  return (
    <Card className="overflow-hidden border-primary/40 bg-card p-0 shadow-md shadow-primary/10">
      <div className="flex items-center justify-between border-b border-border/60 bg-primary/5 px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          draft · <span className="font-mono">gpt-5.4</span>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          conf {reply.confidence.toFixed(2)}
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {renderWithCitations(reply.reply_text)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
            stage: {reply.detected_stage}
          </span>
          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
            intent: {reply.detected_intent}
          </span>
          {reply.suggested_tool !== "none" ? (
            <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">
              tool: {reply.suggested_tool}
            </span>
          ) : null}
          {reply.below_threshold ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive">
              <AlertTriangle className="h-3 w-3" /> below threshold
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border/60 bg-muted/20 px-4 py-2">
        <Button variant="ghost" size="sm" onClick={onCopy}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
        </Button>
        <Button variant="ghost" size="sm" onClick={onRegenerate}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFeedbackOpen(true)}
          disabled={!reply.reply_log_id}
        >
          <MessageSquareWarning className="mr-1.5 h-3.5 w-3.5" /> Feedback
        </Button>
      </div>
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        agentId={agentId}
        replyLogId={reply.reply_log_id}
      />
    </Card>
  );
}

function FeedbackDialog({
  open,
  onOpenChange,
  agentId,
  replyLogId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agentId: string;
  replyLogId: string;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const body = text.trim();
    if (body.length < 3) {
      toast.error("Add a bit more detail — what went wrong?");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/agents/${agentId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_log_id: replyLogId, feedback_text: body }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not submit feedback");
        return;
      }
      toast.success("Thanks — analyzing in the background.");
      setText("");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>What's wrong with this reply?</DialogTitle>
          <DialogDescription>
            Be specific — the worker will analyze which knowledge chunk is
            responsible and propose a fix for your review.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder='e.g. "It says office hours are 9–17, but we changed to 10–18 last month."'
          disabled={submitting}
          className="resize-none"
          autoFocus
        />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || text.trim().length < 3}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit feedback"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function renderWithCitations(text: string): React.ReactNode[] {
  // Highlight [kb-N], [sop-N], [tov-N] etc inline
  const parts = text.split(/(\[[a-z]+-\d+\])/gi);
  return parts.map((p, i) =>
    /^\[[a-z]+-\d+\]$/i.test(p) ? (
      <span
        key={i}
        className="mx-0.5 inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary align-baseline"
      >
        {p.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function ConfidencePanel({
  reply,
  threshold,
}: {
  reply: Reply;
  threshold: number;
}) {
  return (
    <Card className="space-y-5 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Confidence
        </span>
        <StatusPill
          variant={
            reply.below_threshold ? "below-threshold" : "above-threshold"
          }
        />
      </div>
      <div>
        <div className="flex items-baseline gap-3">
          <div className="text-4xl font-semibold tabular-nums">
            {reply.confidence.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground">
            weighted composite
            <br />
            threshold {threshold.toFixed(2)}
          </div>
        </div>
        <ThresholdBar value={reply.confidence} threshold={threshold} />
      </div>
      <div className="space-y-2">
        <Row label="retrieval" value={reply.confidence_breakdown.retrieval} />
        <Row label="intent" value={reply.confidence_breakdown.intent} />
        <Row
          label="groundedness"
          value={reply.confidence_breakdown.groundedness}
        />
        <Row
          label="consistency"
          value={reply.confidence_breakdown.consistency}
        />
      </div>
    </Card>
  );
}

function ThresholdBar({
  value,
  threshold,
}: {
  value: number;
  threshold: number;
}) {
  return (
    <div className="relative mt-3 h-1.5 overflow-visible rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
      <div
        aria-hidden
        className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded-sm bg-foreground"
        style={{ left: `${Math.round(threshold * 100)}%` }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="w-10 text-right font-mono tabular-nums">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function RetrievalTrace({ reply }: { reply: Reply }) {
  const chunks = reply.retrieved_chunks;
  const tags = useMemo(() => {
    // Split per-chunk tag chip extraction (metadata entry may be absent — fall back gracefully)
    return chunks.map((c) => [c.content_type]);
  }, [chunks]);

  return (
    <Card className="space-y-3 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Retrieval trace
        </span>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <TraceChip>HNSW + FTS</TraceChip>
          <TraceChip>RRF</TraceChip>
          <TraceChip>rerank</TraceChip>
        </div>
      </div>
      {chunks.length === 0 ? (
        <div className="rounded border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No chunks retrieved.
        </div>
      ) : (
        <div className="space-y-2">
          {chunks.map((c, i) => (
            <ChunkCard key={c.id} chunk={c} index={i} tags={tags[i] ?? []} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TraceChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}

function ChunkCard({
  chunk,
  index,
  tags,
}: {
  chunk: RetrievedChunk;
  index: number;
  tags: string[];
}) {
  const isTop = index === 0;
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition",
        isTop ? "border-primary/60 bg-primary/5" : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold",
              isTop
                ? "bg-primary/20 text-primary"
                : "bg-muted text-foreground/80",
            )}
          >
            {chunk.score.toFixed(2)}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {chunk.content_type}-{index + 1}
          </span>
        </div>
        <span className="line-clamp-1 max-w-[12rem] font-mono text-[10px] text-muted-foreground">
          {chunk.source}
        </span>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-foreground/85">
        {chunk.content}
      </p>
      {tags.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/70"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ─── SSE helpers ─────────────────────────────────────────────────────── */

async function safeJson(
  res: Response,
): Promise<{ error?: { message?: string } } | null> {
  try {
    return (await res.json()) as { error?: { message?: string } };
  } catch {
    return null;
  }
}

function parseSseFrame(frame: string): { type: string; data: unknown } | null {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const raw of frame.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { type: eventName, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}
